const getPageOfUsers = async (pageNumber, correlationId) => {
  return Promise.resolve({
    users: [],
    numberOfPages: 0,
  });
};

const getUserForSAUsername = async (username, correlationId) => {
  return Promise.resolve(undefined);
};

module.exports = {
  getPageOfUsers,
  getUserForSAUsername,
};
