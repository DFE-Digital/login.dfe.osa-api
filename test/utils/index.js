const mockConfig = (customConfig) => {
  const config = {
    directories: {
      type: 'static',
    },
  };
  return Object.assign(config, customConfig);
};

const mockLogger = () => {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    mockResetAll: function () {
      this.info.mockReset();
      this.warn.mockReset();
      this.error.mockReset();
    },
  };
};

module.exports = {
  mockConfig,
  mockLogger,
};
