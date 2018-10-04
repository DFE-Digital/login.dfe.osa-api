jest.mock('./../../../src/infrastructure/config', () => require('./../../utils').mockConfig());
jest.mock('./../../../src/infrastructure/logger', () => require('./../../utils').mockLogger());
jest.mock('ioredis');
jest.mock('./../../../src/infrastructure/oldSecureAccess');
jest.mock('./../../../src/app/syncUsers/cache');
jest.mock('./../../../src/infrastructure/organisations');
jest.mock('./../../../src/infrastructure/access');

const { getUserByUsername: getOsaUser } = require('./../../../src/infrastructure/oldSecureAccess');
const { getPreviousDetailsForUser, setPreviousDetailsForUser } = require('./../../../src/app/syncUsers/cache');
const { setUserRoleAtOrganisation, getOrganisationByExternalId } = require('./../../../src/infrastructure/organisations');
const { setUserAccessToService, removeUserAccessToService } = require('./../../../src/infrastructure/access');
const handleSyncOsaUser = require('./../../../src/app/syncUsers/syncOsaUserHandler');

const id = 999;
const osaUsername = 'sausername';
const userId = 'user-1';
const osaUser = {
  firstName: 'User',
  lastName: 'One',
  email: 'user.one@unit.tests',
  username: osaUsername,
  osaId: 369,
  organisation: {
    osaId: 258,
    name: 'Test org',
    urn: '796571',
    localAuthority: '123',
    type: '001',
    role: {
      id: 10000,
      name: 'Approver',
    },
  },
  services: [
    {
      id: 'df2ae7f3-917a-4489-8a62-8b9b536a71cc',
      name: 'Analyse school performance',
      roles: [
        'role_1',
      ],
    },
  ],
};
const unchangedPreviousUserState = {
  organisation: {
    osaId: 258,
    name: 'Test org',
    urn: '796571',
    localAuthority: '123',
    type: '001',
    role: {
      id: 10000,
      name: 'Approver',
    },
  },
  services: [
    {
      id: 'df2ae7f3-917a-4489-8a62-8b9b536a71cc',
      name: 'Analyse school performance',
      roles: [
        'role_1',
      ],
    },
  ],
};
const orgId = 'organisation-1';

describe('When syncing an OSA users details', () => {
  beforeEach(() => {
    getOsaUser.mockReset().mockReturnValue(osaUser);

    getPreviousDetailsForUser.mockReset().mockReturnValue(unchangedPreviousUserState);
    setPreviousDetailsForUser.mockReset();

    setUserRoleAtOrganisation.mockReset();
    getOrganisationByExternalId.mockReset().mockReturnValue({
      id: orgId,
    });

    setUserAccessToService.mockReset();
    removeUserAccessToService.mockReset();
  });

  it('then it should not do anything if the user has not changed', async () => {
    await handleSyncOsaUser(id, osaUsername, userId);

    expect(setUserRoleAtOrganisation).toHaveBeenCalledTimes(0);
    expect(setUserAccessToService).toHaveBeenCalledTimes(0);
    expect(removeUserAccessToService).toHaveBeenCalledTimes(0);
  });

  it('then it should update role if changed', async () => {
    const changedPreviousState = Object.assign({}, unchangedPreviousUserState);
    changedPreviousState.organisation.role = {
      id: 0,
      name: 'End User',
    };
    getPreviousDetailsForUser.mockReturnValue(changedPreviousState);

    await handleSyncOsaUser(id, osaUsername, userId);

    expect(setUserRoleAtOrganisation).toHaveBeenCalledTimes(1);
    expect(setUserRoleAtOrganisation).toHaveBeenCalledWith(userId, orgId, osaUser.organisation.role.id, `syncosauser-${id}`);
  });

  it('then it should add new services', async () => {
    const changedPreviousState = Object.assign({}, unchangedPreviousUserState);
    changedPreviousState.services = [];
    getPreviousDetailsForUser.mockReturnValue(changedPreviousState);

    await handleSyncOsaUser(id, osaUsername, userId);

    const expectedIdentifiers = [
      { key: 'organisationId', value: osaUser.organisation.osaId },
      { key: 'groups', value: (osaUser.services[0].roles || []).join(',') },
      { key: 'saUserId', value: osaUser.osaId },
      { key: 'saUserName', value: osaUser.username },
    ];
    expect(setUserAccessToService).toHaveBeenCalledTimes(1);
    expect(setUserAccessToService).toHaveBeenCalledWith(userId, osaUser.services[0].id, orgId, expectedIdentifiers, `syncosauser-${id}`);
  });

  it('then it should update service when roles have changed', async () => {
    const changedPreviousState = Object.assign({}, unchangedPreviousUserState);
    changedPreviousState.services[0] = Object.assign({}, changedPreviousState.services[0], { roles: ['role_2'] });
    getPreviousDetailsForUser.mockReturnValue(changedPreviousState);

    await handleSyncOsaUser(id, osaUsername, userId);

    const expectedIdentifiers = [
      { key: 'organisationId', value: osaUser.organisation.osaId },
      { key: 'groups', value: (osaUser.services[0].roles || []).join(',') },
      { key: 'saUserId', value: osaUser.osaId },
      { key: 'saUserName', value: osaUser.username },
    ];
    expect(setUserAccessToService).toHaveBeenCalledTimes(1);
    expect(setUserAccessToService).toHaveBeenCalledWith(userId, osaUser.services[0].id, orgId, expectedIdentifiers, `syncosauser-${id}`);
  });

  it('then it should remove services no longer in SA', async () => {
    const changedOsaUser = Object.assign({}, osaUser);
    changedOsaUser.services = [];
    getOsaUser.mockReturnValue(changedOsaUser);

    await handleSyncOsaUser(id, osaUsername, userId);

    expect(removeUserAccessToService).toHaveBeenCalledTimes(1);
    expect(removeUserAccessToService).toHaveBeenCalledWith(userId, unchangedPreviousUserState.services[0].id, orgId, `syncosauser-${id}`);
  });

  it('then it should store state of user for next run', async () => {
    await handleSyncOsaUser(id, osaUsername, userId);

    expect(setPreviousDetailsForUser).toHaveBeenCalledTimes(1);
    expect(setPreviousDetailsForUser).toHaveBeenCalledWith(osaUsername, {
      organisation: osaUser.organisation,
      role: osaUser.role,
      services: osaUser.services,
    });
  });
});