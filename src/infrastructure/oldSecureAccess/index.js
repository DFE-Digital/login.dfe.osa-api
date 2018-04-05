const config = require('./../config');

let adapter;

if (!config.oldSecureAccess || !config.oldSecureAccess.type) {
  throw new Error('Config must include oldSecureAccess.type');
}

if (config.oldSecureAccess.type.toLowerCase() === 'static') {
  adapter = require('./static');
} else if (config.oldSecureAccess.type.toLowerCase() === 'legacy') {
  adapter = require('./legacy');
} else {
  throw new Error(`Unexpected old secure access type ${config.oldSecureAccess.type}. Available options are static or legacy`);
}

module.exports = adapter;
