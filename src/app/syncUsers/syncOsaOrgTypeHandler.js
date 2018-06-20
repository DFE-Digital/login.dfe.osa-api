const logger = require('./../../infrastructure/logger');
const { getOrganisationsByType } = require('./../../infrastructure/oldSecureAccess');
const { upsertOrganisation } = require('./../../infrastructure/organisations');

const syncOsaOrgTypeHandler = async (id, orgType, startAtPage) => {
  logger.info(`Received syncosaorgtype for ${orgType} (job id ${id})`);
  try {
    let pageNumber = startAtPage || 1;
    let hasMorePages = true;
    while (hasMorePages) {
      logger.info(`Starting to read page ${pageNumber} of orgs for job ${id}`);
      const orgEntities = await getOrganisationsByType(orgType, pageNumber);
      const organisations = orgEntities.map((e) => {
        const org = {
          name: e.name,
          category: {
            id: e.type,
          },
          legacyId: e.osaId,
          urn: e.urn,
          uid: e.uid,
          ukprn: e.ukprn,
        };
        if (e.type === '002') {
          org.establishmentNumber = e.localAuthority;
        }
        return org;
      });
      for (let i = 0; i < organisations.length; i += 1) {
        logger.info(`Syncing org ${organisations[i].legacyId} of type ${orgType} from page ${pageNumber}`);
        await upsertOrganisation(organisations[i]);
      }
      hasMorePages = organisations.length > 0;
      pageNumber += 1;
    }
    logger.info(`Successfully syncd orgs of type ${orgType} (job id ${id})`);
  } catch (e) {
    logger.error(`Error syncing orgs of type ${orgType} - ${e.message} (job id ${id})`);
  }
};

module.exports = syncOsaOrgTypeHandler;