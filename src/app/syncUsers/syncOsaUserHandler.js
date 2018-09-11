const logger = require('./../../infrastructure/logger');
const { getUserByUsername: getOsaUser } = require('./../../infrastructure/oldSecureAccess');
const { getPreviousDetailsForUser, setPreviousDetailsForUser } = require('./cache');
const { setUserRoleAtOrganisation, getOrganisationByExternalId } = require('./../../infrastructure/organisations');
const { setUserAccessToService, removeUserAccessToService } = require('./../../infrastructure/access');

const getOrganisationId = async (osaOrganisation) => {
  const organisation = await getOrganisationByExternalId('000', osaOrganisation.osaId);
  if (!organisation) {
    throw new Error(`Cannot find organisation in DfE Sign-in (type:${osaOrganisation.type}, id:${osaOrganisation.osaId})`);
  }
  return organisation.id;
};
const updateRole = async (osaUser, previous, userId, correlationId) => {
  if (previous && previous.organisation.role.id === osaUser.organisation.role.id) {
    return; // No update
  }

  await setUserRoleAtOrganisation(userId, osaUser.organisation.id, osaUser.organisation.role.id, correlationId);

  logger.info(`updated role of ${osaUser.username} / ${userId} to ${osaUser.organisation.role.name} (${osaUser.organisation.role.id})`);
};
const addNewServices = async (osaUser, previous, userId, correlationId) => {
  let newServices = osaUser.services;
  if (previous) {
    newServices = osaUser.services.filter(s => !previous.services.find(ps => ps.id === s.id));
  }

  for (let i = 0; i < newServices.length; i += 1) {
    const service = newServices[i];
    const externalIdentifiers = [
      { key: 'organisationId', value: osaUser.organisation.osaId },
      { key: 'groups', value: (service.roles || []).join(',') },
      { key: 'saUserId', value: osaUser.osaId },
      { key: 'saUserName', value: osaUser.username },
    ];

    await setUserAccessToService(userId, service.id, osaUser.organisation.id, externalIdentifiers, correlationId);

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

    await removeUserAccessToService(userId, service.id, osaUser.organisation.id, correlationId);

    logger.info(`remove service ${service.name} (${service.id}) from ${osaUser.username} / ${userId}`);
  }
};

const handleSyncOsaUser = async (id, osaUsername, userId) => {
  logger.info(`Received syncosauser for ${osaUsername} (userid ${userId}) (job id ${id})`);
  try {
    const osaUser = await getOsaUser(osaUsername);
    const previous = await getPreviousDetailsForUser(osaUsername);
    const correlationId = `syncosauser-${id}`;

    osaUser.organisation.id = await getOrganisationId(osaUser.organisation);

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
