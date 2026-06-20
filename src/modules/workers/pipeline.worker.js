const { Worker } = require("bullmq");
require("dotenv").config();
const createConnection = require("../../config/redis");
const prisma = require("../../lib/prisma");
const connection = createConnection();

const worker = new Worker(
  "pipeline-queue",
  async (job) => {
    console.log(`Processing Job ${job.id}`);

    const { runId } = job.data;

    const run = await prisma.pipelineRun.findUnique({
      where: {
        id: runId,
      },
      include: {
        steps: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!run) {
      throw new Error("Run not found");
    }

    console.log("Run:", run.id);

    for (const step of run.steps) {
      console.log(`Executing ${step.name}`);

      console.log(`Image: ${step.image}`);

      console.log(`Command: ${step.command}`);
    }

    return {
      success: true,
    };
  },
  {
    connection,
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id} failed`);

  console.log(err.message);
});

console.log("Pipeline worker started...");
