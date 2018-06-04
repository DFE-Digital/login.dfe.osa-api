const kue = require('kue');

const connectionString = 'redis://127.0.0.1:6379?db=11';
const queue = kue.createQueue({
  redis: connectionString,
});
const queuedJob = queue.create('syncosauser', { osaUsername: 'iextest516', userId: '83B8C915-72BE-4DDC-BE44-AC4CE4F764AA' })
  .save((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.info(`Job id ${queuedJob.id}`);
    }
  });