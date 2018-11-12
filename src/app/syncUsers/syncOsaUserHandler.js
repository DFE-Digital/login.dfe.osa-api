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
const upsertNewAndUpdatedServices = async (osaUser, previous, userId, correlationId) => {
  let newAndUpdatedServices = osaUser.services;
  if (previous) {
    newAndUpdatedServices = osaUser.services.filter((s) => {
      const prev = previous.services.find(ps => ps.id === s.id);
      const newRoles = (s.roles || []).join(',');
      const prevRoles = prev ? (prev.roles || []).join(',') : '';
      return !prev || newRoles !== prevRoles;
    });
  }

  for (let i = 0; i < newAndUpdatedServices.length; i += 1) {
    const service = newAndUpdatedServices[i];
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
    const osaUser = await getOsaUser(osaUsername, userId);
    const previous = await getPreviousDetailsForUser(osaUsername);
    const correlationId = `syncosauser-${id}`;

    osaUser.organisation.id = await getOrganisationId(osaUser.organisation);

    await updateRole(osaUser, previous, userId, correlationId);
    await upsertNewAndUpdatedServices(osaUser, previous, userId, correlationId);
    await removeOldServices(osaUser, previous, userId, correlationId);

    await setPreviousDetailsForUser(osaUsername, userId, {
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
