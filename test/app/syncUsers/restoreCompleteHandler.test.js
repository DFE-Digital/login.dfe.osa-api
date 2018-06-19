jest.mock('./../../../src/infrastructure/config', () => require('./../../utils').mockConfig());
jest.mock('./../../../src/infrastructure/logger', () => require('./../../utils').mockLogger());
jest.mock('./../../../src/infrastructure/directories');

const { getPageOfUsers } = require('./../../../src/infrastructure/directories');
const handleRestoreComplete = require('./../../../src/app/syncUsers/restoreCompleteHandler');

const page1OfUsers = {
  users: [
    {
      sub: 'user1',
    },
    {
      sub: 'user2',
      legacyUsernames: [],
    },
    {
      sub: 'user3',
    },
  ],
  numberOfPages: 3,
};
const page2OfUsers = {
  users: [
    {
      sub: 'user4',
    },
    {
      sub: 'user5',
      legacyUsernames: ['u005'],
    },
    {
      sub: 'user6',
    },
  ],
  numberOfPages: 3,
};
const page3OfUsers = {
  users: [
    {
      sub: 'user7',
    },
    {
      sub: 'user8',
      legacyUsernames: ['u008a', 'u008b'],
    },
    {
      sub: 'user9',
    },
  ],
  numberOfPages: 3,
};
const id = 123;
const queue = {
  create: jest.fn(),
};
const job = {
  id,
  save: jest.fn(),
};

describe('when a restore of osa has completed', () => {
  beforeEach(() => {
    getPageOfUsers.mockReset().mockImplementation((pageNumber) => {
      if (pageNumber === 1) {
        return page1OfUsers;
      }
      if (pageNumber === 2) {
        return page2OfUsers;
      }
      if (pageNumber === 3) {
        return page3OfUsers;
      }
      return {
        users: [],
        numberOfPages: 0,
      };
    });

    queue.create.mockReset().mockReturnValue(job);

    job.save.mockReset().mockImplementation((callback) => {
      setTimeout(callback, 1);
    });
  });

  it('then it should queue a message when a user has a single legacy username', async () => {
    await handleRestoreComplete(id, queue);

    expect(queue.create).toHaveBeenCalledWith('syncosauser', { osaUsername: 'u005', userId: 'user5' });
  });

  it('then it should queue a message per username when a user has a multiple legacy usernames', async () => {
    await handleRestoreComplete(id, queue);

    expect(queue.create).toHaveBeenCalledWith('syncosauser', { osaUsername: 'u008a', userId: 'user8' });
    expect(queue.create).toHaveBeenCalledWith('syncosauser', { osaUsername: 'u008b', userId: 'user8' });
  });

  it('then it should ignore users that do not have legacy usernames', async () => {
    await handleRestoreComplete(id, queue);

    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user1' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user2' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user3' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user4' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user6' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user7' });
    expect(queue.create).not.toHaveBeenCalledWith('syncosauser', { userId: 'user9' });
  });

  it('then it should read all pages of users from directories', async () => {
    await handleRestoreComplete(id, queue);

    expect(getPageOfUsers.mock.calls).toHaveLength(3);
    expect(getPageOfUsers.mock.calls[0][0]).toBe(1);
    expect(getPageOfUsers.mock.calls[1][0]).toBe(2);
    expect(getPageOfUsers.mock.calls[2][0]).toBe(3);
  });

  it('then it should stop processing and throw error if unable to queue user for sync', async () => {
    job.save.mockReset().mockImplementationOnce((callback) => {
      setTimeout(callback, 1);
    }).mockImplementationOnce((callback) => {
      setTimeout(() => callback(new Error('test')), 1);
    });

    try {
      await handleRestoreComplete(id, queue);
      throw new Error('no error thrown');
    } catch (e) {
      expect(e.message).toBe('test');
    }


    expect(getPageOfUsers.mock.calls).toHaveLength(3);
    expect(queue.create.mock.calls).toHaveLength(2);
    expect(job.save.mock.calls).toHaveLength(2);
  });
});