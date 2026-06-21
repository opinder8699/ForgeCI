const { Queue } = require("bullmq");
const createConnection = require("../../config/redis");
const connection = createConnection()

const pipelineQueue = new Queue(
  "pipeline-queue",
  {
    connection,
    defaultJobOptions: {
      attempts: 3, // 1 original + 2 retries

      removeOnComplete: 100,

      removeOnFail: 100,
    },
  }
);

module.exports = pipelineQueue;