require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const { createBullMQConnection, createRedisConnection } = require("../../config/redis");
const executeStep = require("../../utils/executeStep");
const prisma = require("../../lib/prisma");
const Docker = require("dockerode");

const docker = new Docker();
const workerConnection = createBullMQConnection();
const publisher = createRedisConnection();

const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000;

async function cloneRepo(repoUrl, branch, volumeName) {
  let container;
  console.log("[Worker] Started cloning...");
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
    const logs = await container.logs({ stdout: true, stderr: true });
    const output = logs.toString();

    if (result.StatusCode !== 0) {
      throw new Error(`Repository clone failed: ${output}`);
    }

    console.log("[Worker] Cloned repo successfully");
    return output;
  } finally {
    if (container) {
      await container.remove({ force: true }).catch(() => {});
    }
  }
}

async function processRun(job) {
   console.log("[Worker] processRun started");
  const { runId } = job.data;
    console.log("[Worker] runId:", runId);

  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: {
      pipeline: true,
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!run) throw new Error(`Run ${runId} not found`);

  console.log(`[Worker] Run ${runId} — repo: ${run.pipeline.repoUrl}, branch: ${run.pipeline.branch}`);

  const volumeName = `pipeline-${runId}-workspace`;
  await docker.createVolume({ Name: volumeName });
  console.log("[Worker] Volume created");

  try {
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    await cloneRepo(run.pipeline.repoUrl, run.pipeline.branch, volumeName);

    for (const step of run.steps) {
      if (step.status === "SUCCESS") continue;

      console.log(`[Worker] Running step: ${step.name}`);

      await prisma.pipelineStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      const result = await executeStep(step, volumeName);

      await publisher.publish(
        `run:${runId}`,
        JSON.stringify({ stepId: step.id, stepName: step.name, logs: result.logs })
      );

      if (result.exitCode !== 0) {
        await prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: "FAILED", logs: result.logs, completedAt: new Date() },
        });
        await prisma.pipelineRun.update({
          where: { id: runId },
          data: { status: "FAILED", completedAt: new Date() },
        });
        await publisher.publish(
          `run:${runId}`,
          JSON.stringify({ type: "RUN_COMPLETED", status: "FAILED", runId, error: `Step "${step.name}" failed` })
        );
        throw new Error(`Step "${step.name}" failed with exit code ${result.exitCode}`);
      }

      await prisma.pipelineStep.update({
        where: { id: step.id },
        data: { status: "SUCCESS", logs: result.logs, completedAt: new Date() },
      });

      console.log(`[Worker] Step "${step.name}" succeeded`);
    }

    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: "SUCCESS", completedAt: new Date() },
    });

    await publisher.publish(
      `run:${runId}`,
      JSON.stringify({ type: "RUN_COMPLETED", status: "SUCCESS", runId })
    );

    console.log(`[Worker] Run ${runId} completed successfully`);
  } catch (error) {
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: "FAILED", completedAt: new Date() },
    }).catch(() => {});

    throw error;
  } finally {
    await docker.getVolume(volumeName).remove().catch(() => {});
  }

  return { success: true };
}

const worker = new Worker(
  "pipeline-queue",
  async (job) => {
    console.log(`[Worker] Processing job ${job.id}`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("PIPELINE_TIMEOUT")),
        PIPELINE_TIMEOUT_MS
      )
    );

    try {
      return await Promise.race([processRun(job), timeoutPromise]);
    } catch (error) {
      if (error.message === "PIPELINE_TIMEOUT") {
        await prisma.pipelineRun.update({
          where: { id: job.data.runId },
          data: { status: "FAILED", completedAt: new Date() },
        });
        await publisher.publish(
          `run:${job.data.runId}`,
          JSON.stringify({
            type: "RUN_COMPLETED",
            status: "FAILED",
            runId: job.data.runId,
            error: "Pipeline exceeded time budget",
          })
        );
        throw new UnrecoverableError("Pipeline exceeded time budget");
      }
      throw error;
    }
  },
  { connection: workerConnection, concurrency: 3 } // ← was { workerConnection } which is wrong
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(`[Worker] Worker error: ${err.message}`);
});

console.log("Pipeline worker started...");