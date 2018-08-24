'use strict';


const config = require('./../../infrastructure/config');
const healthCheck = require('login.dfe.healthcheck');
const authenticate = require('./../authenticate/api');
const sync = require('./../sync');
const users = require('./../users/api');

const routes = (app, csrf) => {
  app.use('/healthcheck', healthCheck({ config }));

  app.use('/authenticate', authenticate(csrf));
  app.use('/sync', sync(csrf));
  app.use('/users', users(csrf));
};

module.exports = routes;
