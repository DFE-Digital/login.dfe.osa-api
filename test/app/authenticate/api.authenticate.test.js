const httpMocks = require('node-mocks-http');

jest.mock('./../../../src/infrastructure/config', () => ({
  oldSecureAccess: {
    type: 'static',
  },
}));

jest.mock('./../../../src/app/authenticate/utils/validateCredentials', () => {
  const validateOsaCredentialsStub = jest.fn();
  return {
    validateOsaCredentials: jest.fn().mockImplementation(validateOsaCredentialsStub),
  };
});

const { validateOsaCredentials } = require('./../../../src/app/authenticate/utils/validateCredentials');

describe('When authenticating a request', () => {
  let res;
  let req;
  const expectedRequestCorrelationId = '41ab33e5-4c27-12e9-3451-abb349b12f35';
  let post;

  beforeEach(() => {
    res = httpMocks.createResponse();
    req = {
      body: {
        username: 'testuser',
        password: 'Password1',
      },
      headers: {
        'x-correlation-id': expectedRequestCorrelationId,
      },
      header(header) {
        return this.headers[header];
      },
    };

    post = require('./../../../src/app/authenticate/api/authenticate');
  });
  afterEach(() => {
    expect(res._isEndCalled()).toBe(true);
  });
  it('then a bad request is returned if the username and password are not supplied', async () => {
    req.body = {};

    await post(req, res);

    expect(res.statusCode).toBe(400);
  });
  it('then if the request does not pass authentication an unauthorised response is returned', async () => {
    validateOsaCredentials.mockReturnValue(null);

    await post(req, res);

    expect(res.statusCode).toBe(403);
  });
  it('then if the request is authenticated and valid the user is returned in the response', async () => {
    validateOsaCredentials.mockReturnValue({
      firstName: 'Test',
      lastName: 'Tester',
      email: 'test@tester.local',
    });

    await post(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getData().firstName).toBe('Test');
    expect(res._getData().lastName).toBe('Tester');
    expect(res._getData().email).toBe('test@tester.local');
  });
});
