const { createHash } = require('crypto');
const oldSecureAccess = require('./../../../infrastructure/oldSecureAccess');

const validateCredentials = (username, password, salt, osaUserName, osaPassword) => {
  const hash = createHash('sha512');
  hash.update(password + salt, 'utf8');
  const hashed = hash.digest('hex');
  return hashed === osaPassword && username.toLowerCase() === osaUserName.toLowerCase();
};

const validateOsaCredentials = async (username, password) => {
  const user = await oldSecureAccess.getUserByUsername(username);

  if (!user) {
    return null;
  }

  if (user.status === 'imported' || user.status === 'active') {
    const result = validateCredentials(username, password, user.salt, user.username, user.password);

    if (result === false) {
      return null;
    }

    return user;
  }
  return null;
};


module.exports = { validateOsaCredentials };
