jest.mock('./../../../src/infrastructure/config', () => ({
  oldSecureAccess: {
    type: 'static',
  },
}));

jest.mock('./../../../src/infrastructure/oldSecureAccess', () => {
  return {
    getUserByUsername: jest.fn(),
  };
});

const oldSecureAccess = require('./../../../src/infrastructure/oldSecureAccess');


describe('When validating the user', () => {
  let util;
  let getUserByUserName;
  beforeEach(() =>{

    getUserByUserName = jest.fn().mockReturnValue();
    oldSecureAccess.getUserByUsername = getUserByUserName;
    util = require('./../../../src/app/authenticate/utils/validateCredentials');
  });

  it('the record is retrieved by username', async () => {
    await util.validateOsaCredentials('testusername','testpwd');

    expect(getUserByUserName.mock.calls).toHaveLength(1);
    expect(getUserByUserName.mock.calls[0][0]).toBe('testusername');
  });
  it('then if the user does not exist null is returned', async () => {
    const actual = await util.validateOsaCredentials('testusername','testpwd');

    expect(actual).toBeNull();
  });
  it('then if the users credentials are incorrect then null is returned', async () => {
    getUserByUserName.mockReset().mockReturnValue({
      salt: '',
      userName: '',
      password: '',
    });

    const actual = await util.validateOsaCredentials('testusername','testpwd');

    expect(actual).toBeNull();
  });
  it('then if the users account is archived null is returned', async () => {
    getUserByUserName.mockReset().mockReturnValue({
      salt: '',
      username: 'testusername',
      password: 'e8603172175d138e1724d75c91f788738fcbcc74fc98ee68837075bbb0aaf0f6db567cca1b61ec57ad646d79e39b3b2ed452b8a048f22b265fb74b8a244a828c',
      email: 'test@username.local',
      status: 'archived',
    });

    const actual = await util.validateOsaCredentials('testusername', 'testpwd');
    expect(actual).toBeNull();
  });
  it('then if the users credentials are correct the user is returned', async () => {
    getUserByUserName.mockReset().mockReturnValue({
      salt: '',
      username: 'testusername',
      password: 'e8603172175d138e1724d75c91f788738fcbcc74fc98ee68837075bbb0aaf0f6db567cca1b61ec57ad646d79e39b3b2ed452b8a048f22b265fb74b8a244a828c',
      email: 'test@username.local',
      status: 'active',
    });

    const actual = await util.validateOsaCredentials('testusername','testpwd');

    expect(actual).not.toBeNull();
    expect(actual.email).toBe('test@username.local');
    expect(actual.password).toBe('e8603172175d138e1724d75c91f788738fcbcc74fc98ee68837075bbb0aaf0f6db567cca1b61ec57ad646d79e39b3b2ed452b8a048f22b265fb74b8a244a828c');
  });
});
