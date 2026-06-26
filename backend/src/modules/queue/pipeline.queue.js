const { Queue } = require("bullmq");
const { createBullMQConnection } = require("../../config/redis");

const pipelineQueue = new Queue("pipeline-queue", {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

module.exports = pipelineQueue;