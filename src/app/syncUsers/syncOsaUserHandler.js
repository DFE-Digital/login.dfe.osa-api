const logger = require('./../../infrastructure/logger');

const handleSyncOsaUser = async (id, osaUsername, userId) => {
  logger.info(`Received syncosauser for ${osaUsername} (userid ${userId}) (job id ${id})`);
  try {
    logger.info(`Successfully synced ${osaUsername} (userid ${userId}) (job id ${id})`);
  } catch (e) {
    logger.error(`Error syncing ${osaUsername} (userid ${userId}) - ${e.message} (job id ${id})`);
  }
};

module.exports = handleSyncOsaUser;