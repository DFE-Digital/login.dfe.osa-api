const logger = require('./../../infrastructure/logger');
const { getOrganisationsByType } = require('./../../infrastructure/oldSecureAccess');
const { upsertOrganisation } = require('./../../infrastructure/organisations');

const syncOsaOrgTypeHandler = async (id, orgType) => {
  logger.info(`Received syncosaorgtype for ${orgType} (job id ${id})`);
  try {
    const orgEntities = await getOrganisationsByType(orgType);
    const organisations = orgEntities.map(e => ({
      name: e.name,
      category: {
        id: e.type,
      },
      legacyId: e.osaId,
      urn: e.urn,
      uid: e.uid,
      ukprn: e.ukprn,
    }));
    for (let i = 0; i < organisations.length; i += 1) {
      logger.info(`Syncing org ${organisations[i].legacyId} of type ${orgType}`);
      await upsertOrganisation(organisations[i]);
    }
    logger.info(`Successfully syncd orgs of type ${orgType} (job id ${id})`);
  } catch (e) {
    logger.error(`Error syncing orgs of type ${orgType} - ${e.message} (job id ${id})`);
  }
};

module.exports = syncOsaOrgTypeHandler;