const getOrganisationByExternalId = async (type, externalId, correlationId) => {
  return Promise.resolve(null);
};

const setUserRoleAtOrganisation = async (userId, organisationId, roleId, correlationId) => {
  return Promise.resolve();
};

const setUserAccessToService = async (userId, organisationId, serviceId, correlationId) => {
  return Promise.resolve();
};

const removeUserAccessToService = async (userId, organisationId, serviceId, correlationId) => {
  return Promise.resolve();
}

module.exports = {
  getOrganisationByExternalId,
  setUserRoleAtOrganisation,
  setUserAccessToService,
  removeUserAccessToService,
};
