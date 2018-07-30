const oldSecureAccess = require('./../../infrastructure/oldSecureAccess');
const directories = require('./../../infrastructure/directories');
const kue = require('kue');
const config = require('./../../infrastructure/config');
const logger = require('./../../infrastructure/logger');

const queue = kue.createQueue({
  redis: config.sync.connectionString,
});

const queueUserForSync = async (osaUsername, userId) => {
  return new Promise((resolve, reject) => {
    const queuedJob = queue.create('syncosauser', { osaUsername, userId });
    queuedJob.save((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(queuedJob.id);
      }
    });
  });
};

const requestSyncUser = async (req, res) => {
  const correlationId = req.get('x-correlation-id');

  logger.info(`Request received to sync user ${req.params.username} with id ${correlationId}`, { correlationId });
  const saUser = await oldSecureAccess.getUserByUsername(req.params.username);
  if (!saUser) {
    logger.info(`Rejecting request to sync user ${req.params.username} with id ${correlationId} as user not found`, { correlationId });
    return res.status(404).send();
  }

  const user = await directories.getUserForSAUsername(saUser.username);
  if (!user) {
    logger.info(`Rejecting request to sync user ${req.params.username} with id ${correlationId} as user has not migrated yet`, { correlationId });
    return res.status(400).send('User has not migrated account yet');
  }

  const jobId = await queueUserForSync(saUser.username, user.sub);
  logger.info(`Sent sync user job with id ${jobId} for ${req.params.username} (id: ${user.sub}) for request ${correlationId}`, { correlationId });

  return res.status(202).send();
};

module.exports = requestSyncUser;
