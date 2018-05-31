const schedule = require('node-schedule');
const logger = require('./infrastructure/logger');
const config = require('./infrastructure/config');

const downloadAndRestoreOsaBackup = require('./app/osaRestore');
const { startMonitoring, stopMonitoring } = require('./app/syncUsers');

const osaRestoreSchedule = schedule.scheduleJob(config.schedules.osaRestore, async () => {
  await downloadAndRestoreOsaBackup();
  logger.info(`next invocation of OSA restore schedule will be ${osaRestoreSchedule.nextInvocation()}`);
});
logger.info(`first invocation of OSA restore schedule will be ${osaRestoreSchedule.nextInvocation()}`);

startMonitoring();
process.once('SIGTERM', () => {
  logger.info('stopping');
  stopMonitoring.then(() => {
    logger.info('stopped');
    process.exit(0);
  }).catch((e) => {
    logger.error(`Error stopping - ${e.message}`);
    process.exit(1);
  });
});
