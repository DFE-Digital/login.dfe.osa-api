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
  setUserRoleAtOrganisation,
  setUserAccessToService,
  removeUserAccessToService,
};
