const logger = require('./../../infrastructure/logger');
const { getUserByUsername: getOsaUser } = require('./../../infrastructure/oldSecureAccess');
const { getPreviousDetailsForUser, setPreviousDetailsForUser } = require('./cache');
const { setUserRoleAtOrganisation, setUserAccessToService, removeUserAccessToService } = require('./../../infrastructure/organisations');

const updateRole = async (osaUser, previous, userId, correlationId) => {
  if (previous && previous.role.id === osaUser.role.id) {
    return; // No update
  }

  await setUserRoleAtOrganisation(userId, osaUser.organisation.id, osaUser.role.id, correlationId);

  logger.info(`updated role of ${osaUser.username} / ${userId} to ${osaUser.role.name} (${osaUser.role.id})`);
};
const addNewServices = async (osaUser, previous, userId, correlationId) => {
  let newServices = osaUser.services;
  if (previous) {
    newServices = osaUser.services.filter(s => !previous.services.find(ps => ps.id === s.id));
  }

  for (let i = 0; i < newServices.length; i += 1) {
    const service = newServices[i];

    await setUserAccessToService(userId, osaUser.organisation.id, service.id, correlationId);

    logger.info(`added service ${service.name} (${service.id}) to ${osaUser.username} / ${userId}`);
  }
};
const removeOldServices = async (osaUser, previous, userId, correlationId) => {
  let removedServices = [];
  if (previous) {
    removedServices = previous.services.filter(ps => !osaUser.services.find(s => s.id === ps.id));
  }

  for (let i = 0; i < removedServices.length; i += 1) {
    const service = removedServices[i];

    await removeUserAccessToService(userId, osaUser.organisation.id, service.id, correlationId);

    logger.info(`remove service ${service.name} (${service.id}) from ${osaUser.username} / ${userId}`);
  }
};

const handleSyncOsaUser = async (id, osaUsername, userId) => {
  logger.info(`Received syncosauser for ${osaUsername} (userid ${userId}) (job id ${id})`);
  try {
    const osaUser = await getOsaUser(osaUsername);
    const previous = await getPreviousDetailsForUser(osaUsername);
    const correlationId = `syncosauser-${id}`;

    // TODO: Embelish mapped org id
    osaUser.organisation.id = 'coming soon';

    await updateRole(osaUser, previous, userId, correlationId);
    await addNewServices(osaUser, previous, userId, correlationId);
    await removeOldServices(osaUser, previous, userId, correlationId);

    await setPreviousDetailsForUser(osaUsername, {
      organisation: osaUser.organisation,
      role: osaUser.role,
      services: osaUser.services,
    });

    logger.info(`Successfully synced ${osaUsername} (userid ${userId}) (job id ${id})`);
  } catch (e) {
    logger.error(`Error syncing ${osaUsername} (userid ${userId}) - ${e.message} (job id ${id})`);
  }
};

module.exports = handleSyncOsaUser;