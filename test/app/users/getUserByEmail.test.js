jest.mock('./../../../src/infrastructure/config', () => require('./../../utils').mockConfig());
jest.mock('./../../../src/infrastructure/logger', () => require('./../../utils').mockLogger());
jest.mock('./../../../src/infrastructure/oldSecureAccess', () => {
  return {
    getUserByUsername: jest.fn(),
    getUserByEmail: jest.fn(),
  };
});

const httpMocks = require('node-mocks-http');
const { getUserByEmail, getUserByUsername } = require('./../../../src/infrastructure/oldSecureAccess');
const getSAUser = require('./../../../src/app/users/api/getUserByEmail');

describe('When getting an OSA user', () => {
  let res;
  let req;

  beforeEach(() => {
    res = httpMocks.createResponse();
    req = {
      params: {
        id: 'testusername',
      },
    };
  });
  afterEach(() => {
    expect(res._isEndCalled()).toBe(true);
  });

  it('then it should find by email', async () => {
    req.params.id = 'testusername@testing.com';
    getUserByEmail.mockReset().mockReturnValue({
      email: 'testusername@testing.com',
    });
    await getSAUser(req, res);
    expect(getUserByEmail).toHaveBeenCalledTimes(1);
    expect(getUserByEmail.mock.calls[0][0]).toBe('testusername@testing.com');
  });

  it('then it should find by username', async () => {
    getUserByUsername.mockReset().mockReturnValue({
      username: 'testusername',
    });
    await getSAUser(req, res);
    expect(getUserByUsername).toHaveBeenCalledTimes(1);
    expect(getUserByUsername.mock.calls[0][0]).toBe('testusername');
    expect(res.statusCode).toBe(200);
  });

  it('then it should return 404 response if no user defined', async () => {
    getUserByEmail.mockReturnValue(undefined);
    getUserByUsername.mockReturnValue(undefined);
    await getSAUser(req, res);
    expect(res.statusCode).toBe(404);
  });
});

