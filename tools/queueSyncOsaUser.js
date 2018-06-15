const kue = require('kue');

const connectionString = 'redis://127.0.0.1:6379?db=11';
const queue = kue.createQueue({
  redis: connectionString,
});
const queuedJob = queue.create('syncosauser', { osaUsername: 'fagufaze', userId: 'BD211C7B-28FF-462D-932C-E0CFEEF80649' })
  .save((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.info(`Job id ${queuedJob.id}`);
    }
  });