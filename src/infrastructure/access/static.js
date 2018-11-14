const setUserAccessToService = async (userId, organisationId, serviceId, externalIdentifiers, roles, correlationId) => {
  return Promise.resolve();
};

const removeUserAccessToService = async (userId, organisationId, serviceId, correlationId) => {
  return Promise.resolve();
};

const getRolesOfService = async (serviceId, correlationId) => {
  return Promise.resolve([]);
};

module.exports = {
  setUserAccessToService,
  removeUserAccessToService,
  getRolesOfService,
};
