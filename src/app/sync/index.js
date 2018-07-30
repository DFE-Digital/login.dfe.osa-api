'use strict';

const express = require('express');
const apiAuth = require('login.dfe.api.auth');
const config = require('./../../infrastructure/config');
const { asyncWrapper } = require('login.dfe.express-error-handling');

const requestSyncUser = require('./requestSyncUser');

const router = express.Router();

const routes = () => {
  // Add auth middleware
  if (config.hostingEnvironment.env !== 'dev') {
    router.use('/', apiAuth(router, config));
  }

  // Map routes to functions.
  router.put('/users/:username', asyncWrapper(requestSyncUser));

  return router;
};

module.exports = routes;
