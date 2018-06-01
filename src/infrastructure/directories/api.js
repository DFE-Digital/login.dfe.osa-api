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


const getPageOfUsers = async (pageNumber, correlationId) => {
  const token = await jwtStrategy(config.directories.service).getBearerToken();

  try {
    const uri = `${config.directories.service.url}/users?page=${pageNumber}&include=legacyusernames`;
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

module.exports = {
  getPageOfUsers,
};
