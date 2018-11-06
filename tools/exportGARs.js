const { db, users } = require('./../src/infrastructure/oldSecureAccess/schemas/legacySecureAccess.schema');
const { QueryTypes } = require('sequelize');
const uniq = require('lodash/uniq');
const uniqBy = require('lodash/uniqBy');
const flatten = require('lodash/flatten');
const uuid = require('uuid/v4');
const rp = require('request-promise');
const jwtStrategy = require('login.dfe.jwt-strategies');
const path = require('path');
const fs = require('fs');

const settings = {
  output: {
    directory: process.env.OUTPUT_DIR,
  },
  organisations: {
    stub: true,
    url: process.env.ORG_URL,
    auth: {
      type: 'aad',
      tenant: process.env.AAD_TENANT,
      authorityHostUrl: process.env.AAD_AUTHURL,
      clientId: process.env.AAD_CLIENTID,
      clientSecret: process.env.AAD_CLIENTSECRET,
      resource: process.env.AAD_RESOURCE,
    },
  },
  directories: {
    stub: false,
    url: process.env.DIR_URL,
    auth: {
      type: 'aad',
      tenant: process.env.AAD_TENANT,
      authorityHostUrl: process.env.AAD_AUTHURL,
      clientId: process.env.AAD_CLIENTID,
      clientSecret: process.env.AAD_CLIENTSECRET,
      resource: process.env.AAD_RESOURCE,
    },
  },
};

const forEach = async (source, iteratee) => {
  for (let i = 0; i < source.length; i += 1) {
    await iteratee(source[i]);
  }
};

class Maps {
  constructor() {
    this.applications = [
      { source: 'SAFE', destination: 'OSA' },
      { source: 'EvolveTSS', destination: 'EvolveTSS' },
      { source: 'COLLECT', destination: '4FD40032-61A6-4BEB-A6C4-6B39A3AF81C1' },
      { source: 'S2S', destination: '09ABFB35-3D09-41A7-9E4E-B8512B9B7D5E' },
      { source: 'KTS', destination: '57E972F8-0EDA-4F0F-AAF9-50B55662C528' },
      { source: 'EvolveEmpAccessSchool', destination: 'AA4BD63E-61B8-421F-90DF-8EF2CD15AA38' },
      { source: 'EvolveTrainingProvider', destination: '0D15C5BD-CA2F-4211-B789-853BB34CE884' },
      { source: 'EvolveEmpAccessAgent', destination: 'DDFA2FA3-9824-4678-A2E0-F34D6D71948E' },
      { source: 'EvolveAppropriateBody', destination: '8FBA5FDE-832B-499B-957E-8BCD97D11B2D' },
      { source: 'Post16CoursePortal', destination: '09C66A38-C8C2-448D-87C5-A4895FB7F8DE' },
      { source: 'EduBase', destination: '2354CB2E-F559-4BF4-9981-4F6C6890AA5E' },
      { source: 'RAISEonline', destination: 'DF2AE7F3-917A-4489-8A62-8B9B536A71CC' },
      { source: 'AnalyseSchoolPerformance', destination: 'DF2AE7F3-917A-4489-8A62-8B9B536A71CC' },
      { source: 'EvolveEmpAccessSchoolProd', destination: 'AA4BD63E-61B8-421F-90DF-8EF2CD15AA38' },
      { source: 'EvolveEmpAccessAgentProd', destination: 'DDFA2FA3-9824-4678-A2E0-F34D6D71948E' },
      { source: 'EvolveAppropriateBodyProd', destination: '8FBA5FDE-832B-499B-957E-8BCD97D11B2D' },
      { source: 'CustomerExchange', destination: '913BA321-9547-46B2-93C3-A7A7FFC2E3E2' },
      { source: 'CustomerExchangeTest', destination: '913BA321-9547-46B2-93C3-A7A7FFC2E3E2' },
    ];
    this.fields = [
      { source: 'organisation.status', destination: 'organisation.status.id' },
      { source: 'organisation', destination: 'organisation.id' },
      { source: 'organisation.extension.value(type)', destination: 'organisation.type.id' },
      { source: 'organisation.extension.value(phase)', destination: 'organisation.phaseOfEducation.id' },
      { source: 'groups', destination: 'role.id' },
      { source: 'organisation.region', destination: 'organisation.region.id' },
      { source: 'this', destination: 'id' },
      { source: 'organisation.type', destination: 'organisation.category.id' },
      { source: 'organisation.localAuthority', destination: 'organisation.localAuthority.id' },
    ];
    this.operators = [
      { source: 'dic.is', destination: 'is' },
      { source: 'entity.is', destination: 'is' },
      { source: 'entity.list.has', destination: 'is' },
      { source: 'dic.is_not', destination: 'is_not' },
      { source: 'entity.list.has.none', destination: 'is_not' },
      { source: 'entity.is_not', destination: 'is_not' },
    ];

    this.jitLoaders = {};
    this.organisations = [];
    this.users = [];
  }

  addJitMapLoader(type, loader) {
    this.jitLoaders[type] = loader;
  }

  async mapId(type, saId) {
    const map = this[type];
    if (!map) {
      throw new Error(`Cannot find map for ${type}`);
    }

    let value = map.find(x => x.source === saId);
    if (!value) {
      const loader = this.jitLoaders[type];
      if (loader) {
        const destination = await loader(saId);
        if (destination) {
          value = { source: saId, destination };
          map.push(destination);
        }
      }
    }
    if (!value) {
      throw new Error(`Cannot find mapping for ${saId} in ${type}`);
    }
    return value.destination;
  }
}

class Context {
  constructor(gars, maps) {
    this.gars = gars;
    this.roles = [];
    this.policies = [];
    this.exceptions = [];

    this._maps = maps;
  }

  async extractRolesFromGars() {
    const groups = uniqBy(flatten(this.gars.map(x => x.groups)), 'id');
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      this.roles.push({
        id: uuid(),
        origin: group.id,
        name: group.name,
        applicationId: await this._maps.mapId('applications', group.applicationCode),
        status: group.status === 'active' ? 1 : 0,
      });
    }
  }

  async mapGarsToPolicies() {
    for (let i = 0; i < this.gars.length; i += 1) {
      const rule = this.gars[i];
      try {
        const conditions = [];
        for (let j = 0; j < rule.conditions.length; j += 1) {
          const condition = rule.conditions[j];
          conditions.push({
            field: await this._maps.mapId('fields', condition.attribute),
            operator: await this._maps.mapId('operators', condition.operator),
            value: condition.options,
          });
        }
        const policy = {
          id: undefined,
          origin: rule.id,
          name: rule.name,
          applicationId: undefined,
          status: rule.status === 'active' ? 1 : 0,
          conditions,
          roles: [],
        };
        const applicationsApplicableTo = uniq(rule.groups.map(g => g.applicationCode));

        for (let j = 0; j < applicationsApplicableTo.length; j += 1) {
          const applicationCode = applicationsApplicableTo[j];
          const applicationId = await this._maps.mapId('applications', applicationCode);
          const applicationRoles = rule.groups.filter(g => g.applicationCode === applicationCode).map((group) => {
            const role = this.roles.find(x => x.origin === group.id);
            if (!role) {
              throw new Error(`Cannot find role mapping for ${group.id} - ${group.name} (app: ${group.applicationCode})`);
            }
            return role.id;
          });
          const applicationPolicy = Object.assign({}, policy, {
            id: uuid(),
            applicationId,
            conditions: JSON.parse(JSON.stringify(policy.conditions)),
            roles: applicationRoles || [],
          });

          this.policies.push(applicationPolicy);
        }
      } catch (e) {
        this.exceptions.push({
          garId: rule.id,
          policyId: null,
          reason: e.message,
        });
      }
    }
  }

  async removePoliciesThatHaveRoleConditionsCrossApplication() {
    const policiesToKeep = [];
    this.policies.forEach((policy) => {
      const roleIdCondition = policy.conditions.find(c => c.field === 'role.id');
      if (!roleIdCondition) {
        policiesToKeep.push(policy);
      } else {
        const rolesNotForApplication = roleIdCondition.value.map(x => this.roles.find(r => r.origin === x)).filter(role => role && role.applicationId !== policy.applicationId);
        if (!rolesNotForApplication || rolesNotForApplication.length === 0) {
          policiesToKeep.push(policy);
        } else {
          this.exceptions.push({
            garId: policy.origin,
            policyId: policy.id,
            reason: `Remove policy as it has a role.id condition value that is not for the same application (example role id:${rolesNotForApplication[0].id}, name:${rolesNotForApplication[0].name}, application:${rolesNotForApplication[0].applicationId}; policy application:${policy.applicationId})`,
          });
        }
      }
    });
    this.policies = policiesToKeep;
  }

  async mapPolicyConditionIdentifiers() {
    await forEach(this.policies, async (policy) => {
      await forEach(policy.conditions, async (condition) => {
        // Map roles
        if (condition.field === 'role.id') {
          const mappedValues = [];
          for (let i = condition.value.length - 1; i >= 0; i -= 1) {
            const role = this.roles.find(r => r.origin === condition.value[i]);
            if (role && role.applicationId === policy.applicationId) {
              mappedValues.push(role.id);
            } else if (role) {
              this.exceptions.push({
                garId: policy.origin,
                policyId: policy.id,
                reason: `Removed role ${condition.value[i]} from role.id condition as it is for application ${role.applicationId} but policy is for application ${policy.applicationId}`,
              });
            } else {
              this.exceptions.push({
                garId: policy.origin,
                policyId: policy.id,
                reason: `Removed role ${condition.value[i]} from role.id condition as no mapping found`,
              });
            }
          }
          condition.value = mappedValues;
        }

        // map organisations
        if (condition.field === 'organisation.id') {
          const mappedValues = [];
          await forEach(condition.value, async (saOrgId) => {
            const organisationId = await this._maps.mapId('organisations', saOrgId);
            mappedValues.push(organisationId);
          });
          condition.value = mappedValues;
        }

        // map users
        if (condition.field === 'id') {
          const mappedValues = [];
          await forEach(condition.value, async (saUserId) => {
            try {
              const userId = await this._maps.mapId('users', saUserId);
              mappedValues.push(userId);
            } catch (e) {
              this.exceptions.push({
                garId: policy.origin,
                policyId: policy.id,
                reason: `Removed user ${saUserId} from id condition as it they have not migrated`,
              });
            }
          });
          condition.value = mappedValues;
        }
      });
    });
  }
}

class ResultsWriter {
  constructor(roles, polices, exceptions) {
    const applicationsToIgnore = ['OSA', 'EvolveTSS'];

    this.roles = roles.filter(x => applicationsToIgnore.find(y => y === x));
    this.polices = polices.filter(x => applicationsToIgnore.find(y => y === x));
    this.exceptions = exceptions;
  }

  saveRoles(destination) {
    let sql = '';
    this.roles.forEach((role) => {
      sql += '-----------------------------------------------------------------------------------------------------------------\n';
      sql += `--- ${role.name} - sa: ${role.origin} / dsi: ${role.id}\n`;
      sql += '-----------------------------------------------------------------------------------------------------------------\n';
      sql += 'INSERT INTO [Role]\n';
      sql += '(Id, Name, ApplicationId, Status, CreatedAt, UpdatedAt)\n';
      sql += 'VALUES\n';
      sql += `(${role.id}, '${role.name}', '${role.applicationId}', ${role.status}, GETDATE(), GETDATE())\n`;
      sql += '\n';
    });

    fs.writeFileSync(destination, sql, 'UTF8');
    console.info(`Saved roles to ${destination}`);
  }

  savePolicies(destination) {
    let sql = '';
    this.polices.forEach((policy) => {
      sql += '-----------------------------------------------------------------------------------------------------------------\n';
      sql += `--- ${policy.name} - app: ${policy.applicationId} / sa: ${policy.origin} / dsi: ${policy.id}\n`;
      sql += '-----------------------------------------------------------------------------------------------------------------\n';
      sql += 'INSERT INTO [Policy]\n';
      sql += '(Id, Name, ApplicationId, Status, CreatedAt, UpdatedAt)\n';
      sql += 'VALUES\n';
      sql += `('${policy.id}', '${policy.name}', '${policy.applicationId}', '${policy.status}', GETDATE(), GETDATE())\n`;
      sql += '\n';

      policy.conditions.forEach((condition) => {
        condition.value.forEach((value) => {
          sql += 'INSERT INTO [PolicyCondition]\n';
          sql += '(Id, PolicyId, Field, Operator, Value, CreatedAt, UpdatedAt)\n';
          sql += 'VALUES\n';
          sql += `('${uuid()}', '${policy.id}', '${condition.field}', '${condition.operator}', '${value}', GETDATE(), GETDATE())\n`;
          sql += '\n';
        });
      });

      policy.roles.forEach((role) => {
        sql += 'INSERT INTO [PolicyRole]\n';
        sql += '(PolicyId, RoleId, CreatedAt, UpdatedAt)\n';
        sql += 'VALUES\n';
        sql += `('${policy.id}', '${role}', GETDATE(), GETDATE())\n`;
        sql += '\n';
      });
    });

    fs.writeFileSync(destination, sql, 'UTF8');
    console.info(`Saved policies to ${destination}`);
  }

  saveExceptions(destination) {
    const json = JSON.stringify(this.exceptions, null, 4);

    fs.writeFileSync(destination, json, 'UTF8');
    console.info(`Saved exceptions to ${destination}`);
  }
}

const getGarsWithCriteria = async () => {
  const results = await db.query('SELECT gar.id, gar.name, gar.description, gar.status, a.code as attribute_code, sc.type as operator, value2.discriminator, value2.text_value, value2.long_value\n' +
    'FROM group_access_rule gar\n' +
    'JOIN search_filter sf on gar.filter = sf.id\n' +
    'JOIN search_criterion sc on sf.id = sc.filter\n' +
    'JOIN gdo_attribute a on sc.attribute = a.id\n' +
    'JOIN rexf_entity_extension extension2 on sc.parameters = extension2.id\n' +
    'JOIN rexf_attribute_value v on extension2.id = v.entity\n' +
    'JOIN rexf_atomic_value value2 on v.id = value2.attribute_value\n' +
    'ORDER BY gar.id, sf.id, sc.id, a.id', { type: QueryTypes.SELECT });
  const rules = [];
  results.forEach((row) => {
    let rule = rules.find(r => r.id === row.id);
    if (!rule) {
      rule = {
        id: row.id,
        name: row.name,
        status: row.status,
        conditions: [],
      };
      rules.push(rule);
    }

    let condition = rule.conditions.find(c => c.attribute === row.attribute_code);
    if (!condition) {
      condition = {
        attribute: row.attribute_code,
        operator: row.operator,
        options: [],
      };
      rule.conditions.push(condition);
    }
    condition.options.push(row.discriminator === 'rexf.long' ? row.long_value : row.text_value);
  });
  return rules;
};
const getGarGroupMappings = async () => {
  const results = await db.query('SELECT gar.id gar_id, ug.id group_id, ug.code group_code, ug.name group_name, ug.description group_description, ug.status group_status, a.code application_code\n' +
    'FROM group_access_rule_to_user_group garug\n' +
    'JOIN group_access_rule gar ON garug.group_access_rule = gar.id\n' +
    'JOIN user_group ug on garug.user_group = ug.id\n' +
    'JOIN customer_application a on ug.application = a.id\n' +
    'ORDER BY garug.group_access_rule, ug.id', { type: QueryTypes.SELECT });
  const rules = [];
  results.forEach((row) => {
    let rule = rules.find(r => r.id === row.gar_id);
    if (!rule) {
      rule = {
        id: row.gar_id,
        groups: [],
      };
      rules.push(rule);
    }

    rule.groups.push({
      id: row.group_id,
      code: row.group_code,
      name: row.group_name,
      description: row.group_description,
      status: row.group_status,
      applicationCode: row.application_code,
    });
  });
  return rules;
};
const mergeGars = (garsAndCriteria, garGroups) => {
  const merged = [];
  garsAndCriteria.forEach((rule) => {
    const groupMappings = garGroups.find(m => m.id === rule.id);
    if (!groupMappings) {
      return;
    }

    merged.push(Object.assign({}, rule, { groups: groupMappings.groups }));
  });
  return merged;
};
const getGars = async () => {
  const garsAndCriteria = await getGarsWithCriteria();
  const garGroups = await getGarGroupMappings();
  const rules = mergeGars(garsAndCriteria, garGroups);

  return rules;
};

const loadOrganisation = async (saId) => {
  if (settings.organisations.stub) {
    return uuid();
  }

  try {
    const token = await jwtStrategy(settings.organisations).getBearerToken();
    const organisation = await rp({
      method: 'GET',
      uri: `${settings.organisations.url}/organisations/by-external-id/000/${saId}`,
      headers: {
        'x-correlation-id': 'export-gars',
        authorization: `bearer ${token}`,
      },
      json: true,
    });
    return organisation.id;
  } catch (e) {
    if (e.statusCode === 404) {
      return undefined;
    }
    throw e;
  }
};
const loadUser = async (saId) => {
  if (settings.directories.stub) {
    return uuid();
  }

  const saUser = await users.find({
    where: {
      id: saId,
    },
  });
  if (!saUser) {
    return undefined;
  }

  try {
    const token = await jwtStrategy(settings.directories).getBearerToken();
    const user = await rp({
      method: 'GET',
      uri: `${settings.directories.url}//users/by-legacyusername/${saUser.username}`,
      headers: {
        'x-correlation-id': 'export-gars',
        authorization: `bearer ${token}`,
      },
      json: true,
    });
    return user.sub;
  } catch (e) {
    if (e.statusCode === 404) {
      return undefined;
    }
    throw e;
  }
};

const run = async () => {
  const gars = await getGars();
  const maps = new Maps();

  maps.addJitMapLoader('organisations', loadOrganisation);
  maps.addJitMapLoader('users', loadUser);

  const context = new Context(gars, maps);
  await context.extractRolesFromGars();
  await context.mapGarsToPolicies();
  await context.removePoliciesThatHaveRoleConditionsCrossApplication();
  await context.mapPolicyConditionIdentifiers();

  const writer = new ResultsWriter(context.roles, context.policies, context.exceptions);
  writer.saveRoles(path.join(settings.output.directory, 'roles.sql'));
  writer.savePolicies(path.join(settings.output.directory, 'policies.sql'));
  writer.saveExceptions(path.join(settings.output.directory, 'exceptions.json'));
};
run().then(() => {
  console.info('done');
}).catch((e) => {
  console.error(e.stack);
}).then(() => {
  process.exit();
});
