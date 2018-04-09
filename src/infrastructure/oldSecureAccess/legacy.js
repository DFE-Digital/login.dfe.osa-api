'use strict';

const openpgp = require('openpgp');
const { uniqBy } = require('lodash');
const { Op } = require('sequelize');
const { users, applications, organisations } = require('./schemas/legacySecureAccess.schema');
const config = require('./../config');

const roleMapping = [
  { osa: 'end_user', nsa: { id: 0, name: 'End user' } },
  { osa: 'approver', nsa: { id: 10000, name: 'Approver' } },
  { osa: 'super_admin', nsa: { id: 10000, name: 'Approver' } },
  { osa: 'administrator', nsa: { id: 10000, name: 'Approver' } },
];
const serviceMapping = [
  { code: 'KTS', id: '3bfde961-f061-4786-b618-618deaf96e44' },
  { code: 'COLLECT', id: 'fb27f118-c7cc-4ce4-a2aa-6255cfd34cf0' },
  { code: 'S2S', id: '8c3b6436-8249-4c73-8a35-fceb18cf7bf1' },
  { code: 'Edubase', id: 'da634158-f6ae-4b6a-903c-805be7fd5390' },
];

const decrypt = async (cipheredArray) => {
  if (!cipheredArray) {
    return '';
  }
  const options = {
    message: openpgp.message.read(cipheredArray),
    password: config.oldSecureAccess.params.decryptionKey,
    format: 'utf8',
  };

  const decrypted = await openpgp.decrypt(options);
  return decrypted.data;
};

const mapUserEntity = async (user) => {
  const userApplications = uniqBy(user.groups.map(group => ({
    id: group.application,
  })), item => item.id).filter(application => application.id !== 1);

  const userRoles = user.groups.filter(group => group.application === 1)
    .map(group => roleMapping.find(mapping => mapping.osa === group.code)).sort((x, y) => {
      if (x === null) {
        return 1;
      }
      if (x.nsa.id > y.nsa.id) {
        return -1;
      }
      if (x.nsa.id < y.nsa.id) {
        return 1;
      }
      return 0;
    }).filter(role => role !== null);

  const services = (await Promise.all(userApplications.map(async (application) => {
    const applicationEntity = await applications.find({
      where: {
        id: {
          [Op.eq]: application.id,
        },
      },
    });
    const newAppMap = serviceMapping.find(x => x.code === applicationEntity.code);
    if (!newAppMap) {
      return null;
    }
    return {
      id: newAppMap.id,
      name: applicationEntity.dataValues.name,
      role: userRoles.length > 0 ? userRoles[0].nsa : null,
    };
  }))).filter(x => x !== null && x.role !== null).sort((x, y) => {
    if (x.name < y.name) {
      return -1;
    }
    if (x.name > y.name) {
      return 1;
    }
    return 0;
  });

  const firstName = await decrypt(user.dataValues.first_name);
  const lastName = await decrypt(user.dataValues.last_name);

  return {
    firstName,
    lastName,
    email: user.dataValues.email,
    username: user.dataValues.username,
    password: user.dataValues.password,
    salt: user.dataValues.salt,
    organisation: {
      name: user.org.dataValues.name,
      urn: user.org.dataValues.urn,
      localAuthority: user.org.dataValues.local_authority,
      type: user.org.dataValues.type,
      uid: user.org.dataValues.uid,
      ukprn: user.org.dataValues.ukprn,
    },
    services,
  };
};

const searchForUsers = async (criteria) => {
  try {
    const orgEntities = await organisations.findAll({
      where: {
        name: { [Op.like]: `%${criteria}%` },
      },
    });

    const userQueryOr = [
      { username: { [Op.like]: `%${criteria}%` } },
      { email: { [Op.like]: `%${criteria}%` } },
    ];
    if (orgEntities && orgEntities.length > 0) {
      const orgIds = orgEntities.map(e => e.id);
      userQueryOr.push({
        organisation: { [Op.in]: orgIds },
      });
    }

    const userEntities = await users.findAll({
      where: {
        [Op.or]: userQueryOr,
      },
      include: ['org', 'groups'],
    });
    return await Promise.all(userEntities.map(mapUserEntity));
  } catch (e) {
    throw e;
  }
};

const getUserByUsername = async (username) => {
  try {
    const userEntity = await users.find({
      where: {
        username: {
          [Op.eq]: username,
        },
      },
      include: ['org', 'groups'],
    });

    if (!userEntity) {
      return null;
    }

    return await mapUserEntity(userEntity);
  } catch (e) {
    throw e;
  }
};

module.exports = {
  searchForUsers,
  getUserByUsername,
};
