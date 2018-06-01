const kue = require('kue');
const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');
const handleRestoreComplete = require('./restoreCompleteHandler');
const handleSyncOsaUser = require('./syncOsaUserHandler');

let queue;

const startMonitoring = () => {
  queue = kue.createQueue({
    redis: config.syncJobs.connectionString,
  });
  queue.on('error', (e) => {
    logger.warn(`An error occured in the monitor queue - ${e.message}`, e);
  });

  logger.info('Monitoring for osarestorecomplete events');
  queue.process('osarestorecomplete', (job, done) => {
    handleRestoreComplete(job.id, queue)
      .then(() => done())
      .catch(e => done(e));
  });

  logger.info('Monitoring for syncosauser events');
  queue.process('syncosauser', (job, done) => {
    handleSyncOsaUser(job.id, job.data.osaUsername, job.data.userId)
      .then(() => done())
      .catch(e => done(e));
  });
};
const stopMonitoring = async () => {
  if (!queue) {
    return Promise.resolve();
  }

  return new Promise((reject, resolve) => {
    try {
      queue.shutdown(5000, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

module.exports = {
  startMonitoring,
  stopMonitoring,
};
