const config = require('./../../config');
const Sequelize = require('sequelize').default;
const assert = require('assert');
const Op = Sequelize.Op;

const getIntValueOrDefault = (value, defaultValue = 0) => {
  if (!value) {
    return defaultValue;
  }
  const int = parseInt(value);
  return isNaN(int) ? defaultValue : int;
};

const databaseName = config.oldSecureAccess.params.name || 'postgres';
const encryptDb = config.oldSecureAccess.params.encrypt || false;

let db;
if (config.oldSecureAccess.params.connectionString) {
  db = new Sequelize(config.oldSecureAccess.params.connectionString);
} else {
  // assert(config.oldSecureAccess.params.username, 'Database property username must be supplied');
  // assert(config.oldSecureAccess.params.password, 'Database property password must be supplied');
  assert(config.oldSecureAccess.params.host, 'Database property host must be supplied');
  assert(config.oldSecureAccess.params.dialect, 'Database property dialect must be supplied, this must be postgres or mssql');

  const dbOpts = {
    retry: {
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/,
      ],
      name: 'query',
      backoffBase: 100,
      backoffExponent: 1.1,
      timeout: 60000,
      max: 5,
    },
    host: config.oldSecureAccess.params.host,
    dialect: config.oldSecureAccess.params.dialect,
    operatorsAliases: Op,
    dialectOptions: {
      encrypt: encryptDb,
      ssl: config.oldSecureAccess.params.ssl || false,
    },
  };
  if (config.oldSecureAccess.params.pool) {
    dbOpts.pool = {
      max: getIntValueOrDefault(config.oldSecureAccess.params.pool.max, 5),
      min: getIntValueOrDefault(config.oldSecureAccess.params.pool.min, 0),
      acquire: getIntValueOrDefault(config.oldSecureAccess.params.pool.acquire, 10000),
      idle: getIntValueOrDefault(config.oldSecureAccess.params.pool.idle, 10000),
    };
  }

  db = new Sequelize(databaseName, config.oldSecureAccess.params.username, config.oldSecureAccess.params.password, dbOpts);
}

const users = db.define('safe_user', {
  id: {
    type: Sequelize.BIGINT,
    primaryKey: true,
  },
  email: {
    type: Sequelize.STRING,
  },
  username: {
    type: Sequelize.STRING,
  },
  first_name: {
    type: Sequelize.BLOB,
  },
  last_name: {
    type: Sequelize.BLOB,
  },
  password: {
    type: Sequelize.STRING,
  },
  salt: {
    type: Sequelize.STRING,
  },

  organisation: {
    as: 'org_id',
    type: Sequelize.BIGINT,
  },
}, {
  tableName: 'safe_user',
  timestamps: false,
});

const organisations = db.define('organisation', {
  id: {
    type: Sequelize.BIGINT,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
  },
  urn: {
    type: Sequelize.INTEGER,
  },
  local_authority: {
    type: Sequelize.STRING,
  },
  type: {
    type: Sequelize.STRING,
  },
  uid: {
    type: Sequelize.BIGINT,
  },
  ukprn: {
    type: Sequelize.BIGINT,
  },
}, {
  tableName: 'organisation',
  timestamps: false,
});

const userToGroupMapping = db.define('safe_user_to_user_group', {
  safe_user: {
    type: Sequelize.BIGINT,
  },
  user_group: {
    type: Sequelize.BIGINT,
  },
}, {
  tableName: 'safe_user_to_user_group',
  timestamps: false,
});

const groups = db.define('user_group', {
  id: {
    type: Sequelize.BIGINT,
    primaryKey: true,
  },
  code: {
    type: Sequelize.BIGINT,
  },
  application: {
    type: Sequelize.STRING,
  },
}, {
  tableName: 'user_group',
  timestamps: false,
});

const applications = db.define('customer_application', {
  id: {
    type: Sequelize.BIGINT,
    primaryKey: true,
  },
  code: {
    type: Sequelize.STRING,
  },
  name: {
    type: Sequelize.STRING,
  },
}, {
  tableName: 'customer_application',
  timestamps: false,
});


users.belongsTo(organisations, { as: 'org', foreignKey: 'organisation' });
users.belongsToMany(groups, { as: 'groups', through: 'safe_user_to_user_group', foreignKey: 'safe_user', otherKey: 'user_group' });

module.exports = {
  db,
  users,
  organisations,
  userToGroupMapping,
  groups,
  applications,
};
