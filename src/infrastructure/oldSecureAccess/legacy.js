'use strict';

const openpgp = require('openpgp');
const { uniqBy } = require('lodash');
const { Op, QueryTypes } = require('sequelize');
const { db, users, applications, organisations } = require('./schemas/legacySecureAccess.schema');
const config = require('./../config');

const SAFE_APPLICATION_ID = '1';

const safeRoleMapping = [
  { osa: 'end_user', nsa: { id: 0, name: 'End user' } },
  { osa: 'approver', nsa: { id: 10000, name: 'Approver' } },
  { osa: 'super_admin', nsa: { id: 10000, name: 'Approver' } },
  { osa: 'administrator', nsa: { id: 10000, name: 'Approver' } },
];
const serviceMapping = [
  { code: 'KTS', id: '3bfde961-f061-4786-b618-618deaf96e44' },
  // { code: 'COLLECT', id: 'fb27f118-c7cc-4ce4-a2aa-6255cfd34cf0' },
  // { code: 'S2S', id: '8c3b6436-8249-4c73-8a35-fceb18cf7bf1' },
  // { code: 'Edubase', id: 'da634158-f6ae-4b6a-903c-805be7fd5390' },
  { code: 'EvolveTSS', id: 'e6c15ca4-b29a-41c3-9c36-274d6bca3cb2' },
  // { code: 'CustomerExchange', id: '88b086dd-325e-4f90-8952-d515608c1d79' },
  // { code: 'CustomerExchangeTest', id: '2ba0c7d4-3818-4619-abdf-e99c75f68768' },
  { code: 'EvolveTrainingProvider', id: '0d15c5bd-ca2f-4211-b789-853bb34ce884' },
  { code: 'EvolveEmpAccessSchool', id: 'aa4bd63e-61b8-421f-90df-8ef2cd15aa38' },
  { code: 'EvolveEmpAccessAgent', id: 'ddfa2fa3-9824-4678-a2e0-f34d6d71948e' },
  { code: 'EvolveAppropriateBody', id: '8fba5fde-832b-499b-957e-8bcd97d11b2d' },
  // { code: 'Post16CoursePortal', id: '88257043-c89c-4772-ab51-49f4d73f3339' },
  // { code: 'EduBase', id: '2f706180-071a-43bb-a21c-b73f6a8cdab8' },
  { code: 'RAISEonline', id: 'df2ae7f3-917a-4489-8a62-8b9b536a71cc' },
];

openpgp.config.ignore_mdc_error = true;

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
  })), item => item.id).filter(application => application.id.toString() !== SAFE_APPLICATION_ID);
  const userServiceRoles = user.groups.filter(group => group.application.toString() !== SAFE_APPLICATION_ID);
  const userSafeRoles = user.groups.filter(group => group.application.toString() === SAFE_APPLICATION_ID)
    .map(group => safeRoleMapping.find(mapping => mapping.osa === group.code))
    .filter(role => role !== null)
    .sort((x, y) => {
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
    });

  const services = (await Promise.all(userApplications.map(async (application) => {
    const applicationEntity = await applications.find({
      where: {
        id: {
          [Op.eq]: application.id,
        },
      },
    });
    const newAppMap = serviceMapping.find(x => x.code.toLowerCase() === applicationEntity.code.toLowerCase());
    if (!newAppMap) {
      return null;
    }
    return {
      id: newAppMap.id,
      name: applicationEntity.dataValues.name,
      roles: userServiceRoles.filter(x => x.dataValues.application.toString() === applicationEntity.dataValues.id.toString()).map(x => x.code),
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
    osaId: user.dataValues.id,
    organisation: {
      /* id: '72711ff9-2da1-4135-8a20-3de1fea31073', */
      osaId: user.org.dataValues.id,
      name: user.org.dataValues.name,
      urn: user.org.dataValues.urn,
      localAuthority: user.org.dataValues.local_authority,
      type: user.org.dataValues.type,
      uid: user.org.dataValues.uid,
      role: userSafeRoles.length > 0 ? userSafeRoles[0].nsa : null,
    },
    // role: userSafeRoles.length > 0 ? userSafeRoles[0].nsa : null,
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
          [Op.eq]: username.toLowerCase(),
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

const dropTablesAndViews = async () => {
  await db.query('DROP SCHEMA IF EXISTS public CASCADE');
  await db.query('DROP SCHEMA IF EXISTS aud_saml CASCADE');
  await db.query('DROP SCHEMA IF EXISTS aud_event CASCADE');
};

const getOrganisationsByType = async (organisationType, pageNumber = 1, pageSize = 500) => {
  try {
    const offset = (pageNumber - 1) * pageSize;
    const orgEntities = await organisations.findAll({
      where: {
        type: {
          [Op.eq]: organisationType,
        },
      },
      order: ['name'],
      offset,
      limit: pageSize,
    });

    return orgEntities.map((org) => ({
      osaId: org.dataValues.id,
      name: org.dataValues.name,
      urn: org.dataValues.urn,
      localAuthority: org.dataValues.local_authority,
      type: org.dataValues.type,
      uid: org.dataValues.uid,
      ukprn: org.dataValues.ukprn,
    }));
  } catch (e) {
    throw e;
  }
};

module.exports = {
  searchForUsers,
  getUserByUsername,
  dropTablesAndViews,
  getOrganisationsByType,
};
