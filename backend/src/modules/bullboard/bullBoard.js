const { createBullBoard } = require("@bull-board/api");

const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");

const { ExpressAdapter } = require("@bull-board/express");

const pipelineQueue = require("../queue/pipeline.queue");

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(pipelineQueue)],
  serverAdapter,
});

module.exports = serverAdapter;
