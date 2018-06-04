const config = require('./../config');
const KeepAliveAgent = require('agentkeepalive').HttpsAgent;
const rp = require('request-promise').defaults({
  agent: new KeepAliveAgent({
    maxSockets: config.hostingEnvironment.agentKeepAlive.maxSockets,
    maxFreeSockets: config.hostingEnvironment.agentKeepAlive.maxFreeSockets,
    timeout: config.hostingEnvironment.agentKeepAlive.timeout,
    keepAliveTimeout: config.hostingEnvironment.agentKeepAlive.keepAliveTimeout,
  }),
});
const jwtStrategy = require('login.dfe.jwt-strategies');

const callApi = async (method, resource, body, correlationId) => {
  const token = await jwtStrategy(config.directories.service).getBearerToken();

  try {
    const opts = {
      method,
      uri: `${config.directories.service.url}/${resource}`,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      json: true,
    };
    if (body) {
      opts.body = body;
    }
    const result = await rp(opts);

    return result;
  } catch (e) {
    throw e;
  }
}

const setUserRoleAtOrganisation = async (userId, organisationId, roleId, correlationId) => {
  await callApi('PUT', `/organisations/${organisationId}/users/${userId}`, { roleId }, correlationId);
};

const setUserAccessToService = async (userId, organisationId, serviceId, correlationId) => {
  await callApi('PUT', `/organisations/${organisationId}/services/${serviceId}/users/${userId}`, undefined, correlationId);
};

const removeUserAccessToService = async (userId, organisationId, serviceId, correlationId) => {
  await callApi('DELETE', `/organisations/${organisationId}/services/${serviceId}/users/${userId}`, undefined, correlationId);
};

module.exports = {
  setUserRoleAtOrganisation,
  setUserAccessToService,
  removeUserAccessToService,
};
