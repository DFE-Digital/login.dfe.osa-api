const config = require('./../../../infrastructure/config');
const Redis = require('ioredis');

let redis;

const getPreviousDetailsForUser = async (username) => {
  if (!redis) {
    redis = new Redis(config.sync.connectionString, { keyPrefix: 'osa:' });
  }

  const json = await redis.get(username.toLowerCase());
  if (!json) {
    return null;
  }

  return JSON.parse(json);
};

const setPreviousDetailsForUser = async (username, details) => {
  if (!redis) {
    redis = new Redis(config.sync.connectionString, { keyPrefix: 'osa:' });
  }

  const json = JSON.stringify(details);
  await redis.set(username.toLowerCase(), json);
};

module.exports = {
  getPreviousDetailsForUser,
  setPreviousDetailsForUser,
};
