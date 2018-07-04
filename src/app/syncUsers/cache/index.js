const config = require('./../../../infrastructure/config');
const Redis = require('ioredis');

const redis = new Redis(config.sync.connectionString, { keyPrefix: 'osa:' });

const getPreviousDetailsForUser = async (username) => {
  const json = await redis.get(username.toLowerCase());
  if (!json) {
    return null;
  }

  return JSON.parse(json);
};

const setPreviousDetailsForUser = async (username, details) => {
  const json = JSON.stringify(details);
  await redis.set(username.toLowerCase(), json);
};

module.exports = {
  getPreviousDetailsForUser,
  setPreviousDetailsForUser,
};
