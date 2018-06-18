const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');
const fs = require('fs');
const { resolve: resolvePath, join: joinPathes } = require('path');
const { spawn } = require('child_process');
const DatabaseClient = require('./DatabaseClient');

const tablesToCopy = ['safe_user'];

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
          '--clean',
          '--if-exists',
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

    const primaryClient = new DatabaseClient(host, port, primaryDbName, username, password, useSSL);
    const tempClient = new DatabaseClient(host, port, tempDbName, username, password, useSSL);
    await primaryClient.connect();
    try {
      await primaryClient.createDatabase(tempDbName);
      await tempClient.connect();

      await tempClient.prepareDatabase();

      await restoreBackup(this.backupPath, host, port, tempDbName, username, password);

      await primaryClient.renameDatabase(backupDbName);
      await tempClient.renameDatabase(primaryDbName);
    } finally {
      try {
        await primaryClient.dropDatabase(backupDbName);
      } catch (e) {
      }

      await primaryClient.disconnect();
      await tempClient.disconnect();
    }
  }
}

module.exports = DataRestorer;