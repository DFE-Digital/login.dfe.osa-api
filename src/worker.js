const schedule = require('node-schedule');
const logger = require('./infrastructure/logger');
const config = require('./infrastructure/config');
const express = require('express');
const healthCheck = require('login.dfe.healthcheck');

const downloadAndRestoreOsaBackup = require('./app/osaRestore');
const { startMonitoring, stopMonitoring } = require('./app/syncUsers');

if(config.schedules.osaRestore.toLowerCase() !== 'disabled') {
  const osaRestoreSchedule = schedule.scheduleJob(config.schedules.osaRestore, async () => {
    await downloadAndRestoreOsaBackup();
    logger.info(`next invocation of OSA restore schedule will be ${osaRestoreSchedule.nextInvocation()}`);
  });
  logger.info(`first invocation of OSA restore schedule will be ${osaRestoreSchedule.nextInvocation()}`);
} else {
  logger.info('OSA restore schedule is disabled');
}

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


const port = process.env.PORT || 3000;
const app = express();
app.use('/healthcheck', healthCheck({ config }));
app.get('/', (req, res) => {
  res.send();
});
app.listen(port, () => {
  logger.info(`Server listening on http://localhost:${port}`);
});
