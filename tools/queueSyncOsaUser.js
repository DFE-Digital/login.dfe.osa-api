const kue = require('kue');

const connectionString = 'redis://127.0.0.1:6379?db=11';
const queue = kue.createQueue({
  redis: connectionString,
});
const queuedJob = queue.create('syncosauser', { osaUsername: 'fagufaze', userId: 'A92D1615-F520-4D0D-A106-9A9554A8D1EF' })
  .save((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.info(`Job id ${queuedJob.id}`);
    }
  });