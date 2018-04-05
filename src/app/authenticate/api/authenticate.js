const { validateOsaCredentials } = require('./../utils/validateCredentials');

const authenticate = async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).send();
  }

  const authResult = await validateOsaCredentials(req.body.username, req.body.password);

  if (!authResult) {
    return res.status(403).contentType('json').send({
      reason_code: 'INVALID_CREDENTIALS',
      reason_description: 'Invalid username or password',
    });
  }

  return res.send(authResult);
};

module.exports = authenticate;
