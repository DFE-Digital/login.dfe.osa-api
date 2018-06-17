const logger = require('./../../infrastructure/logger');
const { getPageOfUsers } = require('./../../infrastructure/directories');
const flatten = require('lodash/flatten');

const queueUserForSync = async (osaUsername, userId, queue) => {
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
const getUsersFromPageThatMigrated = (pageOfUsers) => {
  const migratedUsers = pageOfUsers.users.filter(u => u.legacyUsernames && u.legacyUsernames.length > 0);
  const migratedUserMapping = migratedUsers.map((u) => {
    return u.legacyUsernames.map(lun => ({ osaUsername: lun, userId: u.sub }));
  });
  return flatten(migratedUserMapping);
};

const handleRestoreComplete = async (id, queue) => {
  logger.info(`Received osarestorecomplete event (id: ${id})`);

  const correlationId = `osarestorecomplete-${id}`;
  let pageNumber = 1;
  let hasMorePages = true;
  while (hasMorePages) {
    logger.info(`Reading page ${pageNumber} with correlationid ${correlationId}`);

    const pageOfUsers = await getPageOfUsers(pageNumber, correlationId);
    const migratedUsers = getUsersFromPageThatMigrated(pageOfUsers);
    for (let i = 0; i < migratedUsers.length; i += 1) {
      const user = migratedUsers[i];
      const syncUserJobId = await queueUserForSync(user.osaUsername, user.userId, queue);

      logger.info(`Sent syncosauser for ${user.osaUsername} / ${user.userId}, job id ${syncUserJobId}`);
    }

    pageNumber += 1;
    hasMorePages = pageNumber <= pageOfUsers.numberOfPages;
  }
  logger.info(`Finished processing osarestorecomplete event (id: ${id})`);
};

module.exports = handleRestoreComplete;