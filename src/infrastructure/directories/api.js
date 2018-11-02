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


const getPageOfUsers = async (pageNumber, pageSize, correlationId) => {
  const token = await jwtStrategy(config.directories.service).getBearerToken();

  try {
    const uri = `${config.directories.service.url}/users?page=${pageNumber}&pageSize=${pageSize}&include=legacyusernames`;
    const pageOfUsers = await rp({
      method: 'GET',
      uri,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      json: true,
    });

    return pageOfUsers;
  } catch (e) {
    throw e;
  }
};

const getUserForSAUsername = async (username, correlationId) => {
  const token = await jwtStrategy(config.directories.service).getBearerToken();

  try {
    const uri = `${config.directories.service.url}/users/by-legacyusername/${username}`;
    const user = await rp({
      method: 'GET',
      uri,
      headers: {
        authorization: `bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      json: true,
    });

    return user;
  } catch (e) {
    if (e.statusCode === 404) {
      return undefined;
    }
    throw e;
  }
};

module.exports = {
  getPageOfUsers,
  getUserForSAUsername,
};
