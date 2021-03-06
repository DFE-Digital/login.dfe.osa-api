const kue = require('kue');

const connectionString = 'redis://127.0.0.1:6379?db=11'; // TODO: Get from config
const queue = kue.createQueue({
  redis: connectionString,
});
const queuedJob = queue.create('osarestorecomplete')
  .save((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.info(`Job id ${queuedJob.id}`);
    }
  });