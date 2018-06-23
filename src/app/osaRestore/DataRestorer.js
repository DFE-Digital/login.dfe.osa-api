const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');
const fs = require('fs');
const { resolve: resolvePath, join: joinPathes } = require('path');
const { spawn } = require('child_process');
const DatabaseClient = require('./DatabaseClient');

const leftPad = (string, length, padChar = '0') => {
  const temp = new Array(length).join(padChar) + string;
  return temp.substr(temp.length - length);
};
const getGetTempDbName = () => {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = leftPad(now.getMonth() + 1, 2).toString();
  const dd = leftPad(now.getDate(), 2).toString();
  return `restore${yyyy}${mm}${dd}`;
};
const restoreBackup = async (backupLocation, host, port, dbname, username, password) => {
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
          env: Object.assign({ PGPASSWORD: password }, process.env),
        };
        const args = [
          `--host=${host}`,
          `--port=${port}`,
          `--dbname=${dbname}`,
          '--schema=public',
          '--clean',
          '--if-exists',
          '--no-owner',
        ];
        if (username) {
          args.push(`--username=${username}`);
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

class DataRestorer {
  constructor(backupPath) {
    this.backupPath = backupPath;
  }

  async restore() {
    const host = config.oldSecureAccess.params.host;
    const port = config.oldSecureAccess.params.port;
    const username = config.oldSecureAccess.params.username;
    const password = config.oldSecureAccess.params.password;
    const primaryDbName = config.oldSecureAccess.params.name;
    const useSSL = config.oldSecureAccess.params.ssl;
    const tempDbName = getGetTempDbName();
    const backupDbName = tempDbName.replace('restore', 'backup');

    let dropBackupDb = false;
    const postgresClient = new DatabaseClient(host, port, 'postgres', username, password, useSSL);
    const tempClient = new DatabaseClient(host, port, tempDbName, username, password, useSSL);

    logger.info('Connecting to postgres');
    await postgresClient.connect();
    try {
      logger.info(`Attempting to drop temp db ${tempDbName}`);
      await postgresClient.dropDatabase(tempDbName);
    } catch (e) {
      if (e.message !== `Error dropping database ${tempDbName} - database "${tempDbName}" does not exist`) {
        logger.warn(`Could not drop temp db ${tempDbName} - ${e.message}`);
      }
    }

    try {
      logger.info(`Create temp database ${tempDbName}`);
      await postgresClient.createDatabase(tempDbName);

      logger.info('Connect to databases');
      await tempClient.connect();

      logger.info('Prepare temp database');
      await tempClient.prepareDatabase();

      // Disconnect while we restore. It takes a while and our connection often gets killed
      logger.info('Disconnecting for restore');
      await tempClient.disconnect();
      await postgresClient.disconnect();

      await restoreBackup(this.backupPath, host, port, tempDbName, username, password);

      logger.info('Reconnecting after restore');
      await postgresClient.connect();

      logger.info('Rename current database');
      await postgresClient.renameDatabase(primaryDbName, backupDbName);
      dropBackupDb = true;

      logger.info('Rename temp database');
      await postgresClient.renameDatabase(tempDbName, primaryDbName);
    } finally {
      if (dropBackupDb) {
        try {
          logger.info('Drop backup database');
          await postgresClient.dropDatabase(backupDbName);
        } catch (e) {
          logger.warn(e.message);
        }
      }

      await postgresClient.disconnect();
      await tempClient.disconnect();
    }
  }
}

module.exports = DataRestorer;