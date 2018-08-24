const users = [
  {
    firstName: 'Tony',
    lastName: 'Stark',
    email: 'tony.stark@stark-industries.test',
    username: 'ironman',
    organisation: {
      id: 'org1',
      name: 'Some School',
    },
    role: {
      id: 10000,
      name: 'Approver',
    },
    services: [
      {
        id: 'svc1',
        name: 'Service One',
      },
      {
        id: 'svc2',
        name: 'Service Two',
      },
    ],
  },
];

const searchForUsers = async criteria => users.filter(user => user.email.toLowerCase().includes(criteria.toLowerCase())
      || user.username.toLowerCase().includes(criteria.toLowerCase()));

const getUserByUsername = async username => users.find(user => user.username.toLowerCase() === username.toLowerCase());

const getUserByEmail = async email => users.find(user => user.email.toLowerCase() === email.toLowerCase());

const dropTablesAndViews = async () => {
  return Promise.resolve();
};

module.exports = {
  searchForUsers,
  getUserByUsername,
  getUserByEmail,
  dropTablesAndViews,
};
