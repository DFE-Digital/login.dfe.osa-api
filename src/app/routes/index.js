'use strict';


const config = require('./../../infrastructure/config');
const healthCheck = require('login.dfe.healthcheck');
const authenticate = require('./../authenticate/api');

const routes = (app, csrf) => {
  app.use('/healthcheck', healthCheck({ config }));

  app.use('/authenticate', authenticate(csrf));
};

module.exports = routes;
