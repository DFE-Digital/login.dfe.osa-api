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
const kue = require('kue');

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

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

const downloadBackup = async () => {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Starting download of OSA backup');

      const object = {
        Bucket: s3Config.bucketName,
        Key: getObjectKey(s3Config.objectNameFormat),
      };
      logger.info(`Getting ${JSON.stringify(object)}`);
      const s3 = new aws.S3();
      s3.getObject(object, (err, data) => {
        if (err) {
          reject(new Error(`Error downloading OSA backup - ${err.message}`));
          return;
        }

        logger.info('Finished downloading OSA backup');
        resolve(data.Body);
      });
    } catch (e) {
      reject(new Error(`Error downloading OSA backup - ${e.message}`));
    }
  });
};
const decryptData = async (encryptedData) => {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Decrypting OSA backup');
      const salt = encryptedData.slice(8, 16);
      const body = encryptedData.slice(16);
      const password = Buffer.from(config.oldSecureAccess.backup.decryptionKey, 'utf8');

      const hash0 = new Buffer('');
      const hash1 = md5(Buffer.concat([hash0, password, salt]));
      const hash2 = md5(Buffer.concat([hash1, password, salt]));
      const hash3 = md5(Buffer.concat([hash2, password, salt]));
      const key = Buffer.concat([hash1, hash2]);
      const iv = hash3;

      const decoder = crypto.createDecipheriv('aes-256-cbc', key, iv);

      const chunks = [];
      let index = 0;
      while (index < body.length) {
        let length = body.length - index;
        if (length > 1024) {
          length = 1024;
        }
        const buffer = Buffer.alloc(length);

        body.copy(buffer, 0, index, index + length);
        chunks.push(decoder.update(buffer));
        index += length;
      }
      chunks.push(decoder.final());

      logger.info('Successfully decrypted OSA backup');
      resolve(Buffer.concat(chunks));
    } catch (e) {
      reject(new Error(`Error decrypting OSA backup - ${e.message}`));
    }
  });
};
const saveBackup = async (data) => {
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

  logger.info(`Writing file to ${path}`);
  await writeFileAsync(path, data);

  return path;
};
const restoreBackup = async (backupLocation) => {
  let postgresDir = resolvePath('./external_modules/postgres');
  let platformDir = 'MacOS';
  if (process.platform.match(/^win/i)) {
    platformDir = 'Windows-x86';
    postgresDir = resolvePath('../external_modules/postgres');
  }
  const pgrestoreDir = joinPathes(postgresDir, platformDir);


  const stdoutLog = fs.createWriteStream(`${backupLocation.substr(0, backupLocation.length - 6)}.stdout.log`);
  const stderrLog = fs.createWriteStream(`${backupLocation.substr(0, backupLocation.length - 6)}.stderr.log`);
  try {
    await new Promise((resolve, reject) => {
      try {
        const opts = {
          cwd: pgrestoreDir,
          env: Object.assign({ PGPASSWORD: config.oldSecureAccess.params.password }, process.env),
        };
        const args = [
          `--host=${config.oldSecureAccess.params.host}`,
          `--port=${config.oldSecureAccess.params.port}`,
          `--dbname=${config.oldSecureAccess.params.name}`,
          '--clean',
          '--if-exists',
        ];
        if (config.oldSecureAccess.params.username) {
          args.push(`--username=${config.oldSecureAccess.params.username}`);
        }
        args.push(backupLocation);

        logger.info(`spawning pg_restore in ${opts.cwd} to restore ${backupLocation}`);
        const proc = spawn(`${pgrestoreDir}/pg_restore`, args, opts);
        proc.stdout.on('data', (data) => {
          stdoutLog.write(data);
        });
        proc.stderr.on('data', (data) => {
          stderrLog.write(data);
        });
        proc.on('close', (code) => {
          if (code === 0) {
            logger.info(`pg_restore of ${backupLocation} completed successfully`);
            resolve();
          } else {
            reject(new Error(`pg_restore exited with code ${code}`));
          }
        })
      } catch (e) {
        reject(e.message);
      }
    });
  } finally {
    stdoutLog.end();
    stderrLog.end();
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
        console.info(`Sent osarestorecomplete, job id ${queuedJob.id}`);
        resolve();
      }
    });
  });
}

const downloadAndRestoreOsaBackup = async () => {
  try {
    const encryptedData = await downloadBackup();
    const data = await decryptData(encryptedData);
    const backupPath = await saveBackup(data);
    await dropTablesAndViews();
    await restoreBackup(backupPath);
    await storeFiles(backupPath);

    await notifyRestoreComplete();
  } catch (e) {
    logger.error(e.message);
  }
};

module.exports = downloadAndRestoreOsaBackup;
