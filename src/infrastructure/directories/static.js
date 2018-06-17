const getPageOfUsers = async (pageNumber, correlationId) => {
  return Promise.resolve({
    users: [],
    numberOfPages: 0,
  });
};

module.exports = {
  getPageOfUsers,
};
