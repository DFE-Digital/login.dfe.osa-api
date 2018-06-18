const { Client } = require('pg');

class DatabaseClient {
  constructor(host, port, dbName, username, password, useSSL) {
    this.details = {
      host,
      port,
      dbName,
      username,
      password,
      useSSL,
    };
    this.client = new Client({
      user: username,
      host,
      database: dbName,
      password,
      port,
      ssl: useSSL || false,
    });
    this.isConnected = false;
  }

  async connect() {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
      } catch (e) {
        throw new Error(`Error connecting to ${this.details.dbName} - ${e.message}`);
      }
    }
  }

  async disconnect() {
    if (this.isConnected) {
      try {
        await this.client.end();
        this.isConnected = false;
      } catch (e) {
        throw new Error(`Error disconnecting from ${this.details.dbName} - ${e.message}`);
      }
    }
  }

  async createDatabase(newDbName) {
    try {
      await this.client.query(`CREATE DATABASE ${newDbName}`);
    } catch (e) {
      throw new Error(`Error creating database ${newDbName} - ${e.message}`);
    }
  }

  async dropDatabase(databaseName) {
    try {
      await this.client.query(`DROP DATABASE ${databaseName}`);
    } catch (e) {
      throw new Error(`Error dropping database ${databaseName} - ${e.message}`);
    }
  }

  async prepareDatabase() {
    try {
      const result = await this.client.query('SELECT 1 FROM pg_roles WHERE rolname = \'safe\'');
      if (result.rows.length === 0) {
        await this.client.query('CREATE USER safe');
      }
    } catch (e) {
      throw new Error(`Error preparing database (user safe) - ${e.message}`);
    }

    try {
      const result = await this.client.query('SELECT 1 FROM pg_roles WHERE rolname = \'rdsadmin\'');
      if (result.rows.length === 0) {
        await this.client.query('CREATE ROLE rdsadmin');
      }
    } catch (e) {
      throw new Error(`Error preparing database (role rdsadmin) - ${e.message}`);
    }
  }

  async renameDatabase(newDbName) {
    const renameClient = new Client({
      user: this.details.username,
      host: this.details.host,
      database: 'postgres',
      password: this.details.password,
      port: this.details.port,
      ssl: this.details.ssl || false,
    });

    try {
      await this.client.query('SELECT pg_terminate_backend(pg_stat_activity.pid) ' +
        'FROM pg_stat_activity ' +
        `WHERE pg_stat_activity.datname = '${this.details.dbName}' ` +
        'AND pid <> pg_backend_pid();');

      await this.disconnect();
    } catch (e) {
      throw new Error(`Error disconnection clients from ${this.details.dbName} - ${e.message}`);
    }

    try {
      await renameClient.connect();
    } catch (e) {
      throw new Error(`Error connecting to postgres to rename database from ${this.details.dbName} to ${newDbName} - ${e.message}`);
    }

    try {
      try {
        await renameClient.query(`ALTER DATABASE ${this.details.dbName} RENAME TO ${newDbName}`);
      } catch (e) {
        throw new Error(`Error renaming database from ${this.details.dbName} to ${newDbName} - ${e.message}`);
      }

      this.details.dbName = newDbName;

      try {
        this.client = new Client({
          user: this.details.username,
          host: this.details.host,
          database: this.details.dbName,
          password: this.details.password,
          port: this.details.port,
          ssl: this.details.ssl || false,
        });
        await this.connect();
      } catch (e) {
        throw new Error(`Error switching connection to new database ${newDbName}`);
      }
    } finally {
      renameClient.end();
    }
  }
}

module.exports = DatabaseClient;