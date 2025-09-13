const os = require('os');
const mediasoup = require('mediasoup');
const totalThreads = os.cpus().length;
const config = require('../config/config');

const createWorkers = () => new Promise(async (resolve, reject) => {
    let workers = [];
    console.log(`--> Starting to create ${totalThreads} Mediasoup workers...`); // <-- ADD THIS

    for (let i = 0; i < totalThreads; i++) {
        console.log(`    Creating worker ${i + 1} of ${totalThreads}...`); // <-- ADD THIS
        try {
            const worker = await mediasoup.createWorker({
                rtcMinPort: config.workerSettings.rtcMinPort,
                rtcMaxPort: config.workerSettings.rtcMaxPort,
                logLevel: config.workerSettings.logLevel,
                logTags: config.workerSettings.logTags,
            });

            worker.on('died', () => {
                console.error("WORKER HAS DIED");
                process.exit(1);
            });

            console.log(`    -> Worker ${i + 1} created successfully (pid: ${worker.pid})`); // <-- ADD THIS
            workers.push(worker);
        } catch (err) {
            console.error(`!!! FAILED to create worker ${i + 1}`, err); // <-- ADD THIS
            reject(err);
            return; // Stop the process if one worker fails
        }
    }
    
    console.log("--> All workers created successfully."); // <-- ADD THIS
    resolve(workers);
});

module.exports = createWorkers;