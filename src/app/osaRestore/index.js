const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');
const aws = require('aws-sdk');
const { resolve: resolvePath, join: joinPathes } = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { copyFileToBlob } = require('./azureBlobStorage');
const { dropTablesAndViews } = require('./../../infrastructure/oldSecureAccess');
const DataRestorer = require('./DataRestorer');
const kue = require('kue');

const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);

const s3Config = config.oldSecureAccess.backup;
if (s3Config && s3Config.accessKey && s3Config.accessSecret) {
  aws.config.update({
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.accessSecret,
  });
}

const leftPad = (string, length, padChar = '0') => {
  const temp = new Array(length).join(padChar) + string;
  return temp.substr(temp.length - length);
};
const getObjectKey = (nameFormat) => {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = leftPad(now.getMonth() + 1, 2).toString();
  const dd = leftPad(now.getDate(), 2).toString();
  return nameFormat.replace('{yyyy}', yyyy)
    .replace('{mm}', mm).replace('{dd}', dd);
};
const md5 = (data) => {
  const hash = crypto.createHash('md5');
  hash.update(data);
  return new Buffer(hash.digest('hex'), 'hex');
};

const getSavePath = async () => {
  const dir = resolvePath('./download');
  const fileName = `${Date.now()}.pgsql`;
  const path = joinPathes(dir, fileName);

  try {
    logger.info(`Ensuring directory ${dir} exists`);
    await mkdirAsync(dir);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }

  return path;
};
const getObjectPart = async (s3, key, offset, length) => {
  const start = offset;
  const end = start + length;
  const object = {
    Bucket: s3Config.bucketName,
    Key: key,
    Range: `bytes=${start}-${end}`,
  };
  return new Promise((resolve, reject) => {
    s3.getObject(object, (err, data) => {
      if (err) {
        return reject(new Error(`Error downloading block ${start}-${end} of ${key} from S3 - ${err.message}`));
      }

      const contentRange = data.ContentRange.match(/^bytes\s([0-9]{1,})\-([0-9]{1,})\/([0-9]{1,})$/);
      const totalLength = parseInt(contentRange[3]);

      return resolve({
        start,
        end,
        totalLength,
        data: data.Body,
      });
    });
  });
};
const getDecoder = (firstDataPath) => {
  const salt = firstDataPath.slice(8, 16);
  const password = Buffer.from(config.oldSecureAccess.backup.decryptionKey, 'utf8');

  const hash0 = new Buffer('');
  const hash1 = md5(Buffer.concat([hash0, password, salt]));
  const hash2 = md5(Buffer.concat([hash1, password, salt]));
  const hash3 = md5(Buffer.concat([hash2, password, salt]));
  const key = Buffer.concat([hash1, hash2]);
  const iv = hash3;

  return crypto.createDecipheriv('aes-256-cbc', key, iv);
};
const downloadAndDecryptBackupToDisk = async () => {
  try {
    logger.info('Starting download of OSA backup');

    const s3 = new aws.S3();
    const objectKey = getObjectKey(s3Config.objectNameFormat);
    const path = await getSavePath();
    const saveStream = fs.createWriteStream(path);

    let offset = 0;
    let decoder;
    let totalLength = -1;
    while (totalLength === -1 || offset < totalLength) {
      let downloadLength = totalLength === -1 ? 1048576 : totalLength - offset;
      if (downloadLength > 1048576) {
        downloadLength = 1048576;
      }
      logger.debug(`Downloading ${downloadLength} bytes, starting at ${offset} for ${objectKey} (total length: ${totalLength === -1 ? 'unknown' : totalLength})`);

      const block = await getObjectPart(s3, objectKey, offset, downloadLength);

      if (!decoder) {
        decoder = getDecoder(block.data);
        block.data = block.data.slice(16);
      }

      const decodedBlock = decoder.update(block.data);
      saveStream.write(decodedBlock);

      totalLength = block.totalLength;
      offset = block.end + 1;
    }

    const decodedFinal = decoder.final();
    saveStream.end(decodedFinal);

    logger.info(`Finshed download of OSA backup. Saved to ${path}`);
    return path;
  } catch (e) {
    throw new Error(`Error downloading OSA backup - ${e.message}`);
  }
};
const storeFiles = async (backupLocation) => {
  const backupStdoutLocation = `${backupLocation.substr(0, backupLocation.length - 6)}.stdout.log`;
  const backupStderrLocation = `${backupLocation.substr(0, backupLocation.length - 6)}.stderr.log`;

  logger.info(`Copying ${backupLocation} to archive`);
  await copyFileToBlob(backupLocation);

  logger.info(`Copying ${backupStdoutLocation} to archive`);
  await copyFileToBlob(backupStdoutLocation);

  logger.info(`Copying ${backupStderrLocation} to archive`);
  await copyFileToBlob(backupStderrLocation);
};
const notifyRestoreComplete = async () => {
  const queue = kue.createQueue({
    redis: config.sync.connectionString,
  });
  return new Promise((resolve, reject) => {
    const queuedJob = queue.create('osarestorecomplete');
    queuedJob.save((err) => {
      if (err) {
        reject(err);
      } else {
        logger.info(`Sent osarestorecomplete, job id ${queuedJob.id}`);
        resolve();
      }
    });
  });
};
const deleteFile = async (path) => {
  try {
    logger.info(`Deleting file ${path}`);
    await unlinkAsync(path);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
};
const deleteDownloadsLocally = async (backupLocation) => {
  const backupStdoutLocation = `${backupLocation.substr(0, backupLocation.length - 6)}.stdout.log`;
  const backupStderrLocation = `${backupLocation.substr(0, backupLocation.length - 6)}.stderr.log`;

  await Promise.all([
    deleteFile(backupStderrLocation),
    deleteFile(backupStdoutLocation),
    deleteFile(backupLocation),
  ]);
};

const downloadAndRestoreOsaBackup = async () => {
  try {
    const backupPath = await downloadAndDecryptBackupToDisk();

    const restorer = new DataRestorer(backupPath);
    await restorer.restore();

    await notifyRestoreComplete();

    await storeFiles(backupPath);

    await deleteDownloadsLocally(backupPath);
  } catch (e) {
    logger.error(e.message);
  }
};

module.exports = downloadAndRestoreOsaBackup;
