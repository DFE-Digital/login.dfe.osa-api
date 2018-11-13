const config = require('./../../../infrastructure/config');
const Redis = require('ioredis');

const redis = new Redis(config.sync.connectionString, { keyPrefix: 'osa:' });

const getPreviousDetailsForUser = async (username, userId) => {
  const json = await redis.get(`${username.toLowerCase()}-${userId.toLowerCase()}`);
  if (!json) {
    return null;
  }

  return JSON.parse(json);
};

const setPreviousDetailsForUser = async (username, userId, details) => {
  const json = JSON.stringify(details);
  await redis.set(`${username.toLowerCase()}-${userId.toLowerCase()}`, json);
};

module.exports = {
  getPreviousDetailsForUser,
  setPreviousDetailsForUser,
};
