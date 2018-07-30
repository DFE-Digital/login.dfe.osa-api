jest.mock('./../../../src/infrastructure/config', () => require('./../../utils').mockConfig());
jest.mock('./../../../src/infrastructure/logger', () => require('./../../utils').mockLogger());
jest.mock('kue');
jest.mock('./../../../src/infrastructure/directories');
jest.mock('./../../../src/infrastructure/oldSecureAccess');

const queue = {
  create: jest.fn(),
};
const job = {
  id: 123,
  save: jest.fn(),
};
const kue = require('kue');
kue.createQueue.mockReset().mockReturnValue(queue);

const directories = require('./../../../src/infrastructure/directories');
const oldSecureAccess = require('./../../../src/infrastructure/oldSecureAccess');
const httpMocks = require('node-mocks-http');
const requestSyncUser = require('./../../../src/app/sync/requestSyncUser');


describe('when processing request to sync user', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      params: {
        username: 'sauserone',
      },
      get: () => 'correlation-id',
    };

    res = httpMocks.createResponse();

    directories.getUserForSAUsername.mockReset().mockReturnValue({
      sub: 'user-1',
    });

    oldSecureAccess.getUserByUsername.mockReset().mockReturnValue({
      username: 'sauserone',
    });

    queue.create.mockReset().mockReturnValue(job);

    job.save.mockReset().mockImplementation((callback) => {
      setTimeout(callback, 1);
    });

    kue.createQueue.mockReset().mockReturnValue(queue);
  });

  it('then it should return 202', async () => {
    await requestSyncUser(req, res);

    expect(res.statusCode).toBe(202);
  });

  it('then it should queue job for user to be syncd', async () => {
    await requestSyncUser(req, res);

    expect(queue.create).toHaveBeenCalledTimes(1);
    expect(queue.create).toHaveBeenCalledWith('syncosauser', {
      osaUsername: 'sauserone',
      userId: 'user-1',
    });
  });

  it('and the sa username is not found then it should return 404', async () => {
    oldSecureAccess.getUserByUsername.mockReturnValue(undefined);

    await requestSyncUser(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('and a user is not found with sa username then it should return 400', async () => {
    directories.getUserForSAUsername.mockReturnValue(undefined);

    await requestSyncUser(req, res);

    expect(res.statusCode).toBe(400);
  });
});