const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');
const aws = require('aws-sdk');
const { resolve: resolvePath, join: joinPathes } = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { promisify } = require('util');

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
  const now = new Date(2017, 9, 12);
  const yyyy = now.getFullYear().toString();
  const mm = leftPad(now.getMonth() + 1, 2).toString();
  const dd = leftPad(now.getDate(), 2).toString();
  return nameFormat.replace('{yyyy}', yyyy)
    .replace('{mm}', mm).replace('{dd}', dd);
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
  const postgresDir = resolvePath('./external_modules/postgres');
  let platformDir = 'MacOS';
  if (process.platform.match(/^win/i)) {
    platformDir = 'Windows-x86';
  }
  const pgrestoreDir = joinPathes(postgresDir, platformDir);


  const stdoutLog = fs.createWriteStream(backupLocation.substr(0, backupLocation.length - 6) + '.stdout.log');
  const stderrLog = fs.createWriteStream(backupLocation.substr(0, backupLocation.length - 6) + '.stderr.log');
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
          `--username=${config.oldSecureAccess.params.username}`,
          `--dbname=${config.oldSecureAccess.params.database}`,
          backupLocation,
        ];
        logger.info(`spawning pg_restore in ${opts.cwd} to restore ${backupLocation}`);
        const proc = spawn('pg_restore', args, opts);
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

const downloadAndRestoreOsaBackup = async () => {
  try {
    const data = await downloadBackup();
    const backupPath = await saveBackup(data);
    await restoreBackup(backupPath);
  } catch (e) {
    logger.error(e.message);
  }
};

module.exports = downloadAndRestoreOsaBackup;
