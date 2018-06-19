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
const queueMigratedUsersForSync = async (correlationId, queue) => {
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
};

const queueOrgTypeForSync = async (orgType, queue) => {
  return new Promise((resolve, reject) => {
    const queuedJob = queue.create('syncosaorgtype', { orgType });
    queuedJob.save((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(queuedJob.id);
      }
    });
  });
};
const queueOrgTypesForSync = async (correlationId, queue) => {
  const orgTypesToSync = ['001', '004', '008', '009', '010', '011', '012', '013'];
  for (let i = 0; i < orgTypesToSync.length; i += 1) {
    const jobId = await queueOrgTypeForSync(orgTypesToSync[i], queue);
    logger.info(`Sent syncosaorgtype for ${orgTypesToSync[i]}, job id ${jobId}`);
  }
};

const handleRestoreComplete = async (id, queue) => {
  logger.info(`Received osarestorecomplete event (id: ${id})`);

  const correlationId = `osarestorecomplete-${id}`;

  await queueMigratedUsersForSync(correlationId, queue);
  await queueOrgTypesForSync(correlationId, queue);

  logger.info(`Finished processing osarestorecomplete event (id: ${id})`);
};

module.exports = handleRestoreComplete;