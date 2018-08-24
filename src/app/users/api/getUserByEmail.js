const { getUserByUsername, getUserByEmail } = require('./../../../infrastructure/oldSecureAccess');
const logger = require('./../../../infrastructure/logger');
const { safeUser } = require('./../../utils/safeUser');

const getSAUser = async (req, res) => {
  const id = req.params.id;
  try {
    let user = await getUserByUsername(id);
    if (!user) {
      user = await getUserByEmail(id);
    }
    if (!user) {
      return res.status(404).send();
    }
    return res.status(200).send(safeUser(user));
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

module.exports = getSAUser;
