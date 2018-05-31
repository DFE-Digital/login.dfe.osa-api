const logger = require('./../../infrastructure/logger');

const handleSyncOsaUser = async (id, osaUsername) => {
  logger.info(`Received syncosauser for ${osaUsername} (job id ${id})`);
  try {
    logger.info(`Successfully synced ${osaUsername} (job id ${id})`);
  } catch (e) {
    logger.error(`Error syncing ${osaUsername} - ${e.message} (job id ${id})`);
  }
};

module.exports = handleSyncOsaUser;