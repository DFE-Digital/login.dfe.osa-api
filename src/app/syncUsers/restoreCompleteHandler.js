const logger = require('./../../infrastructure/logger');

const queueUserForSync = async (username, queue) => {
  return new Promise((resolve, reject) => {
    const queuedJob = queue.create('syncosauser', { osaUsername: 'bob' })
      .save((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(queuedJob.id);
        }
      });
  });
};

const handleRestoreComplete = async (queue) => {
  logger.info('Received osarestorecomplete event');

  const osaUsername = 'bob';
  const jobId = await queueUserForSync(osaUsername, queue);
  logger.info(`Send syncosauser for ${osaUsername}, job id ${jobId}`);
};

module.exports = handleRestoreComplete;