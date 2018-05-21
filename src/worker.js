const schedule = require('node-schedule');

schedule.scheduleJob('*/1 * * * *', () => {
  console.log('Tick');
});

console.log('Started');