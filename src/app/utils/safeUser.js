'use strict';

const { pick } = require('lodash');

const safeUser = user => pick(user, ['osaId', 'username', 'firstName', 'lastName', 'email', 'organisation', 'services']);


module.exports = { safeUser };
