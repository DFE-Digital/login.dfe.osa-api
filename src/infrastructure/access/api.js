const config = require('./../config');
const KeepAliveAgent = require('agentkeepalive').HttpsAgent;
const rp = require('login.dfe.request-promise-retry').defaults({
  agent: new KeepAliveAgent({
    maxSockets: config.hostingEnvironment.agentKeepAlive.maxSockets,
    maxFreeSockets: config.hostingEnvironment.agentKeepAlive.maxFreeSockets,
    timeout: config.hostingEnvironment.agentKeepAlive.timeout,
    keepAliveTimeout: config.hostingEnvironment.agentKeepAlive.keepAliveTimeout,
  }),
});
const jwtStrategy = require('login.dfe.jwt-strategies');


const setUserAccessToService = async (userId, serviceId, organisationId, externalIdentifiers = [], roles = [], correlationId) => {
  const token = await jwtStrategy(config.access.service).getBearerToken();

  try {
    await rp({
      method: 'PUT',
      uri: `${config.access.service.url}/users/${userId}/services/${serviceId}/organisations/${organisationId}`,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      body: {
        identifiers: externalIdentifiers,
        roles,
      },
      json: true,
    });

    return true;
  } catch (e) {
    const status = e.statusCode ? e.statusCode : 500;
    if (status === 403) {
      return false;
    }
    throw e;
  }
};

const removeUserAccessToService = async (userId, serviceId, organisationId, correlationId) => {
  const token = await jwtStrategy(config.access.service).getBearerToken();

  try {
    await rp({
      method: 'DELETE',
      uri: `${config.access.service.url}/users/${userId}/services/${serviceId}/organisations/${organisationId}`,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      json: true,
    });

    return true;
  } catch (e) {
    if (e.statusCode === 404) {
      return undefined;
    }
    throw e;
  }
};

const getRolesOfService = async (serviceId, correlationId) => {
  const token = await jwtStrategy(config.access.service).getBearerToken();

  try {
    return await rp({
      method: 'GET',
      uri: `${config.access.service.url}/services/${serviceId}/roles`,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      json: true,
    });
  } catch (e) {
    if (e.statusCode === 404) {
      return undefined;
    }
    throw e;
  }
};

module.exports = {
  setUserAccessToService,
  removeUserAccessToService,
  getRolesOfService,
};
