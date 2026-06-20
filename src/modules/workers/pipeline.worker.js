const { Worker } = require("bullmq");
require("dotenv").config();
const createConnection = require("../../config/redis");
const executeStep = require("../../utils/executeStep");
const prisma = require("../../lib/prisma");
const Docker = require("dockerode");
const docker = new Docker();

const connection = createConnection();
const publisher = createConnection(); // separate connection for pub/sub

async function cloneRepo(repoUrl, branch, volumeName) {
  let container;

  try {
    container = await docker.createContainer({
      Image: "alpine/git",

      Cmd: ["clone", "--branch", branch, "--depth", "1", repoUrl, "/workspace"],

      HostConfig: {
        Binds: [`${volumeName}:/workspace`],
      },
    });

    await container.start();

    const result = await container.wait();

    const logs = await container.logs({
      stdout: true,
      stderr: true,
    });

    const output = logs.toString();

    if (result.StatusCode !== 0) {
      throw new Error(`Repository clone failed: ${output}`);
    }

    return output;
  } finally {
    if (container) {
      await container.remove({
        force: true,
      });
    }
  }
}

const worker = new Worker(
  "pipeline-queue",
  async (job) => {
    console.log(`Processing Job ${job.id}`);

    const { runId } = job.data;

    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        pipeline: true,
        steps: { orderBy: { order: "asc" } },
      },
    });

    if (!run) {
      throw new Error("Run not found");
    }

    const volumeName = `pipeline-${runId}-workspace`;
    await docker.createVolume({ Name: volumeName });

    try {
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      await cloneRepo(run.pipeline.repoUrl, run.branch, volumeName);

      for (const step of run.steps) {
        if (step.status === "SUCCESS") continue;

        await prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: "RUNNING", startedAt: new Date() },
        });

        const result = await executeStep(step, volumeName);

        await publisher.publish(
          `run:${runId}`,
          JSON.stringify({ stepId: step.id, logs: result.logs }),
        );

        if (result.exitCode !== 0) {
          await prisma.pipelineStep.update({
            where: { id: step.id },
            data: {
              status: "FAILED",
              logs: result.logs,
              completedAt: new Date(),
            },
          });

          await prisma.pipelineRun.update({
            where: { id: runId },
            data: { status: "FAILED", completedAt: new Date() },
          });

          throw new Error(`Step ${step.name} failed`);
        }

        await prisma.pipelineStep.update({
          where: { id: step.id },
          data: {
            status: "SUCCESS",
            logs: result.logs,
            completedAt: new Date(),
          },
        });
      }

      await prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: "SUCCESS", completedAt: new Date() },
      });
      await publisher.publish(
        `run:${runId}`,
        JSON.stringify({
          type: "RUN_COMPLETED",

          status: "SUCCESS",

          runId,
        }),
      );
    } catch (error) {
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: "FAILED", completedAt: new Date() },
      });
      await publisher.publish(
        `run:${runId}`,
        JSON.stringify({
          type: "RUN_COMPLETED",

          status: "FAILED",

          runId,

          error: error.message,
        }),
      );
      throw error; // still let BullMQ know it failed, for retry logic
    } finally {
      await docker.getVolume(volumeName).remove();
    }

    return { success: true };
  },
  { connection, concurrency: 3 },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id} failed`);
  console.log(err.message);
});

console.log("Pipeline worker started...");
