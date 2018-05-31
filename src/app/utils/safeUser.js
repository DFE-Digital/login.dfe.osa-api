'use strict';

const { pick } = require('lodash');

const safeUser = user => pick(user, ['username', 'firstName', 'lastName', 'email', 'organisation', 'role', 'services']);


module.exports = { safeUser };
