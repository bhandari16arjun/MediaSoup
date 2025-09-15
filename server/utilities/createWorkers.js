const os = require('os');
const mediasoup = require('mediasoup');
const config = require('../config/config');

const totalThreads = os.cpus().length;

const createWorkers = () =>
  new Promise(async (resolve, reject) => {
    const workers = [];
    console.log(`--> Starting to create ${totalThreads} Mediasoup workers...`);
    for (let i = 0; i < totalThreads; i++) {
      console.log(`    Creating worker ${i + 1} of ${totalThreads}...`);
      try {
        const worker = await mediasoup.createWorker({
          rtcMinPort: config.workerSettings.rtcMinPort,
          rtcMaxPort: config.workerSettings.rtcMaxPort,
          logLevel: config.workerSettings.logLevel,
          logTags: config.workerSettings.logTags,
        });
        worker.on('died', () => {
          console.error('WORKER HAS DIED');
          process.exit(1);
        });
        console.log(`    -> Worker ${i + 1} created successfully (pid: ${worker.pid})`);
        workers.push(worker);
      } catch (err) {
        console.error(`!!! FAILED to create worker ${i + 1}`, err);
        reject(err);
        return;
      }
    }
    console.log('--> All workers created successfully.');
    resolve(workers);
  });

module.exports = createWorkers;
