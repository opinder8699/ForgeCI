// require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
// const { createBullMQConnection, createRedisConnection } = require("../../config/redis");
// const executeStep = require("../../utils/executeStep");
// const prisma = require("../../lib/prisma");
// const Docker = require("dockerode");
// const { Worker, UnrecoverableError } = require("bullmq");
// const docker = new Docker();
// const workerConnection = createBullMQConnection();
// const publisher = createRedisConnection();

// const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000;

// async function cloneRepo(repoUrl, branch, volumeName) {
//   let container;
//   console.log("[Worker] Started cloning...");
//   try {
//     container = await docker.createContainer({
//       Image: "alpine/git",
//       Cmd: ["clone", "--branch", branch, "--depth", "1", repoUrl, "/workspace"],
//       HostConfig: {
//         Binds: [`${volumeName}:/workspace`],
//       },
//     });

//     await container.start();
//     const result = await container.wait();
//     const logs = await container.logs({ stdout: true, stderr: true });
//     const output = logs.toString();

//     if (result.StatusCode !== 0) {
//       throw new Error(`Repository clone failed: ${output}`);
//     }

//     console.log("[Worker] Cloned repo successfully");
//     return output;
//   } finally {
//     if (container) {
//       await container.remove({ force: true }).catch(() => {});
//     }
//   }
// }

// async function processRun(job) {
//    console.log("[Worker] processRun started");
//   const { runId } = job.data;
//     console.log("[Worker] runId:", runId);

//   const run = await prisma.pipelineRun.findUnique({
//     where: { id: runId },
//     include: {
//       pipeline: true,
//       steps: { orderBy: { order: "asc" } },
//     },
//   });

//   if (!run) throw new Error(`Run ${runId} not found`);

//   console.log(`[Worker] Run ${runId} — repo: ${run.pipeline.repoUrl}, branch: ${run.pipeline.branch}`);

//   const volumeName = `pipeline-${runId}-workspace`;
//   await docker.createVolume({ Name: volumeName });
//   console.log("[Worker] Volume created");

//   try {
//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "RUNNING", startedAt: new Date() },
//     });

//     await cloneRepo(run.pipeline.repoUrl, run.pipeline.branch, volumeName);

//     for (const step of run.steps) {
//       if (step.status === "SUCCESS") continue;

//       console.log(`[Worker] Running step: ${step.name}`);

//       await prisma.pipelineStep.update({
//         where: { id: step.id },
//         data: { status: "RUNNING", startedAt: new Date() },
//       });

//       const result = await executeStep(step, volumeName);

//       await publisher.publish(
//         `run:${runId}`,
//         JSON.stringify({ stepId: step.id, stepName: step.name, logs: result.logs })
//       );

//       if (result.exitCode !== 0) {
//         await prisma.pipelineStep.update({
//           where: { id: step.id },
//           data: { status: "FAILED", logs: result.logs, completedAt: new Date() },
//         });
//         await prisma.pipelineRun.update({
//           where: { id: runId },
//           data: { status: "FAILED", completedAt: new Date() },
//         });
//         await publisher.publish(
//           `run:${runId}`,
//           JSON.stringify({ type: "RUN_COMPLETED", status: "FAILED", runId, error: `Step "${step.name}" failed` })
//         );
//         throw new Error(`Step "${step.name}" failed with exit code ${result.exitCode}`);
//       }

//       await prisma.pipelineStep.update({
//         where: { id: step.id },
//         data: { status: "SUCCESS", logs: result.logs, completedAt: new Date() },
//       });

//       console.log(`[Worker] Step "${step.name}" succeeded`);
//     }

//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "SUCCESS", completedAt: new Date() },
//     });

//     await publisher.publish(
//       `run:${runId}`,
//       JSON.stringify({ type: "RUN_COMPLETED", status: "SUCCESS", runId })
//     );

//     console.log(`[Worker] Run ${runId} completed successfully`);
//   } catch (error) {
//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "FAILED", completedAt: new Date() },
//     }).catch(() => {});

//     throw error;
//   } finally {
//     await docker.getVolume(volumeName).remove().catch(() => {});
//   }

//   return { success: true };
// }

// const worker = new Worker(
//   "pipeline-queue",
//   async (job) => {
//     console.log(`[Worker] Processing job ${job.id}`);

//     const timeoutPromise = new Promise((_, reject) =>
//       setTimeout(
//         () => reject(new Error("PIPELINE_TIMEOUT")),
//         PIPELINE_TIMEOUT_MS
//       )
//     );

//     try {
//       return await Promise.race([processRun(job), timeoutPromise]);
//     } catch (error) {
//       if (error.message === "PIPELINE_TIMEOUT") {
//         await prisma.pipelineRun.update({
//           where: { id: job.data.runId },
//           data: { status: "FAILED", completedAt: new Date() },
//         });
//         await publisher.publish(
//           `run:${job.data.runId}`,
//           JSON.stringify({
//             type: "RUN_COMPLETED",
//             status: "FAILED",
//             runId: job.data.runId,
//             error: "Pipeline exceeded time budget",
//           })
//         );
//         throw new UnrecoverableError("Pipeline exceeded time budget");
//       }
//       throw error;
//     }
//   },
//   { connection: workerConnection, concurrency: 3 } // ← was { workerConnection } which is wrong
// );

// worker.on("completed", (job) => {
//   console.log(`[Worker] Job ${job.id} completed`);
// });

// worker.on("failed", (job, err) => {
//   console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
// });

// worker.on("error", (err) => {
//   console.error(`[Worker] Worker error: ${err.message}`);
// });

// console.log("Pipeline worker started...");
// require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
// const { createBullMQConnection, createRedisConnection } = require("../../config/redis");
// const executeStep = require("../../utils/executeStep");
// const prisma = require("../../lib/prisma");
// const Docker = require("dockerode");
// const { Worker, UnrecoverableError } = require("bullmq");

// const docker = new Docker();
// const workerConnection = createBullMQConnection();
// const publisher = createRedisConnection();

// const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000;

// // Helper: publish a message to the run's Redis channel
// async function pub(runId, payload) {
//   await publisher.publish(`run:${runId}`, JSON.stringify(payload));
// }

// async function cloneRepo(repoUrl, branch, volumeName, runId, stepId) {
//   let container;
//   console.log("[Worker] Started cloning...");

//   await pub(runId, {
//     type: "log",
//     stepId,
//     stepName: "Clone repository",
//     message: `$ git clone --branch ${branch} --depth 1 ${repoUrl} /workspace`,
//   });

//   try {
//     container = await docker.createContainer({
//       Image: "alpine/git",
//       Cmd: ["clone", "--branch", branch, "--depth", "1", repoUrl, "/workspace"],
//       HostConfig: {
//         Binds: [`${volumeName}:/workspace`],
//       },
//     });

//     await container.start();
//     const result = await container.wait();

//     // Stream clone output
//     const logs = await container.logs({ stdout: true, stderr: true });
//     const output = logs.toString("utf8").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim();
//     if (output) {
//       for (const line of output.split("\n")) {
//         const trimmed = line.trimEnd();
//         if (trimmed) {
//           await pub(runId, { type: "log", stepId, stepName: "Clone repository", message: trimmed });
//         }
//       }
//     }

//     if (result.StatusCode !== 0) {
//       throw new Error(`Repository clone failed (exit ${result.StatusCode})`);
//     }

//     await pub(runId, {
//       type: "log",
//       stepId,
//       stepName: "Clone repository",
//       message: "✓ Repository cloned successfully",
//     });

//     console.log("[Worker] Cloned repo successfully");
//   } finally {
//     if (container) {
//       await container.remove({ force: true }).catch(() => {});
//     }
//   }
// }
// async function cloneRepo(repoUrl, branch, volumeName, runId, stepId) {
//   let container;
//   console.log("[Worker] Started cloning...");

//   const cloneCmd = `git clone --branch ${branch} --depth 1 ${repoUrl} /workspace 2>&1`;

//   await pub(runId, {
//     type: "log",
//     stepId,
//     stepName: "Clone repository",
//     message: `$ git clone --branch ${branch} --depth 1 ${repoUrl} /workspace`,
//   });

//   try {
//     container = await docker.createContainer({
//       Image: "alpine/git",
//       Cmd: ["sh", "-c", cloneCmd],
//       Tty: false,
//       AttachStdout: true,
//       AttachStderr: true,
//       HostConfig: {
//         Binds: [`${volumeName}:/workspace`],
//       },
//     });

//     // Attach BEFORE starting so we don't miss early output
//     const stream = await container.attach({
//       stream: true,
//       stdout: true,
//       stderr: true,
//       logs: true,   // include any buffered output on attach
//     });

//     await container.start();

//     // Stream lines live as they arrive
//     const lineBuffer = { data: "" };
//     stream.on("data", (chunk) => {
//       // alpine/git container uses Tty:false so output has Docker multiplexing header
//       // Strip the 8-byte header from each chunk
//       let offset = 0;
//       const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
//       while (offset < buf.length) {
//         if (buf.length - offset < 8) break;
//         const size = buf.readUInt32BE(offset + 4);
//         const payload = buf.slice(offset + 8, offset + 8 + size).toString("utf8");
//         lineBuffer.data += payload;
//         const lines = lineBuffer.data.split("\n");
//         lineBuffer.data = lines.pop(); // keep partial line
//         for (const line of lines) {
//           const trimmed = line.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trimEnd();
//           if (trimmed) {
//             pub(runId, { type: "log", stepId, stepName: "Clone repository", message: trimmed });
//           }
//         }
//         offset += 8 + size;
//       }
//     });

//     const result = await container.wait();

//     // Flush any remaining buffer
//     if (lineBuffer.data.trim()) {
//       pub(runId, {
//         type: "log", stepId, stepName: "Clone repository",
//         message: lineBuffer.data.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim(),
//       });
//     }

//     if (result.StatusCode !== 0) {
//       throw new Error(`Repository clone failed (exit ${result.StatusCode})`);
//     }

//     await pub(runId, {
//       type: "log", stepId, stepName: "Clone repository",
//       message: "✓ Repository cloned successfully",
//     });

//     console.log("[Worker] Cloned repo successfully");
//   } finally {
//     if (container) await container.remove({ force: true }).catch(() => {});
//   }
// }

// async function processRun(job) {
//   console.log("[Worker] processRun started");
//   const { runId } = job.data;
//   console.log("[Worker] runId:", runId);

//   const run = await prisma.pipelineRun.findUnique({
//     where: { id: runId },
//     include: {
//       pipeline: true,
//       steps: { orderBy: { order: "asc" } },
//     },
//   });

//   if (!run) throw new Error(`Run ${runId} not found`);

//   console.log(
//     `[Worker] Run ${runId} — repo: ${run.pipeline.repoUrl}, branch: ${run.pipeline.branch}`
//   );

//   const volumeName = `pipeline-${runId}-workspace`;
//   await docker.createVolume({ Name: volumeName });

//   try {
//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "RUNNING", startedAt: new Date() },
//     });

//     // ── Clone step ──
//     // Use a synthetic "clone" step ID so the frontend can group clone logs
//     const cloneStepId = `clone-${runId}`;
//     await pub(runId, {
//       type: "step_start",
//       stepId: cloneStepId,
//       stepName: "Clone repository",
//       order: 0,
//     });
//     await cloneRepo(run.pipeline.repoUrl, run.pipeline.branch, volumeName, runId, cloneStepId);
//     await pub(runId, {
//       type: "step_end",
//       stepId: cloneStepId,
//       stepName: "Clone repository",
//       status: "SUCCESS",
//     });

//     // ── Build steps ──
//     // ── Build steps ──
// for (const step of run.steps) {
//   if (step.status === "SUCCESS") continue;

//   console.log(`[Worker] Running step: ${step.name}`);

//   await prisma.pipelineStep.update({
//     where: { id: step.id },
//     data: { status: "RUNNING", startedAt: new Date() },
//   });

//   await pub(runId, {
//     type: "step_start",
//     stepId: step.id,
//     stepName: step.name,
//     order: step.order,
//     image: step.image,
//     command: step.command,
//   });

//   // onLog streams each line live as it arrives from the container
//   const result = await executeStep(step, volumeName, async (line) => {
//     await pub(runId, {
//       type: "log",
//       stepId: step.id,
//       stepName: step.name,
//       message: line,
//     });
//   });

//   if (result.exitCode !== 0) {
//     await prisma.pipelineStep.update({
//       where: { id: step.id },
//       data: { status: "FAILED", logs: result.logs, completedAt: new Date() },
//     });
//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "FAILED", completedAt: new Date() },
//     });
//     await pub(runId, {
//       type: "step_end",
//       stepId: step.id,
//       stepName: step.name,
//       status: "FAILED",
//       exitCode: result.exitCode,
//     });
//     await pub(runId, {
//       type: "RUN_COMPLETED",
//       status: "FAILED",
//       runId,
//       error: `Step "${step.name}" failed with exit code ${result.exitCode}`,
//     });
//     throw new Error(`Step "${step.name}" failed with exit code ${result.exitCode}`);
//   }

//   await prisma.pipelineStep.update({
//     where: { id: step.id },
//     data: { status: "SUCCESS", logs: result.logs, completedAt: new Date() },
//   });

//   await pub(runId, {
//     type: "step_end",
//     stepId: step.id,
//     stepName: step.name,
//     status: "SUCCESS",
//     exitCode: 0,
//   });

//   console.log(`[Worker] Step "${step.name}" succeeded`);
// }
// //     for (const step of run.steps) {
// //       if (step.status === "SUCCESS") continue;

// //       console.log(`[Worker] Running step: ${step.name}`);

// //       await prisma.pipelineStep.update({
// //         where: { id: step.id },
// //         data: { status: "RUNNING", startedAt: new Date() },
// //       });

// //       await pub(runId, {
// //         type: "step_start",
// //         stepId: step.id,
// //         stepName: step.name,
// //         order: step.order,
// //         image: step.image,
// //         command: step.command,
// //       });
// //       for (const line of result.logs.split("\n")) {
// //   const trimmed = line.trimEnd();
// //   if (trimmed) {
// //     await pub(runId, {
// //       type: "log",
// //       stepId: step.id,
// //       stepName: step.name,
// //       message: trimmed,
// //     });
// //   }
// // }
// //       // Pass onLog so each output line is published immediately as it arrives
// //       const result = await executeStep(step, volumeName, async (line) => {
// //         await pub(runId, {
// //           type: "log",
// //           stepId: step.id,
// //           stepName: step.name,
// //           message: line,
// //         });
// //       });

// //       if (result.exitCode !== 0) {
// //         await prisma.pipelineStep.update({
// //           where: { id: step.id },
// //           data: { status: "FAILED", logs: result.logs, completedAt: new Date() },
// //         });
// //         await prisma.pipelineRun.update({
// //           where: { id: runId },
// //           data: { status: "FAILED", completedAt: new Date() },
// //         });
// //         await pub(runId, {
// //           type: "step_end",
// //           stepId: step.id,
// //           stepName: step.name,
// //           status: "FAILED",
// //           exitCode: result.exitCode,
// //         });
// //         await pub(runId, {
// //           type: "RUN_COMPLETED",
// //           status: "FAILED",
// //           runId,
// //           error: `Step "${step.name}" failed with exit code ${result.exitCode}`,
// //         });
// //         throw new Error(`Step "${step.name}" failed with exit code ${result.exitCode}`);
// //       }

// //       await prisma.pipelineStep.update({
// //         where: { id: step.id },
// //         data: { status: "SUCCESS", logs: result.logs, completedAt: new Date() },
// //       });

// //       await pub(runId, {
// //         type: "step_end",
// //         stepId: step.id,
// //         stepName: step.name,
// //         status: "SUCCESS",
// //         exitCode: 0,
// //       });

// //       console.log(`[Worker] Step "${step.name}" succeeded`);
// //     }

//     await prisma.pipelineRun.update({
//       where: { id: runId },
//       data: { status: "SUCCESS", completedAt: new Date() },
//     });

//     await pub(runId, { type: "RUN_COMPLETED", status: "SUCCESS", runId });
//     console.log(`[Worker] Run ${runId} completed successfully`);
//   } catch (error) {
//     await prisma.pipelineRun
//       .update({ where: { id: runId }, data: { status: "FAILED", completedAt: new Date() } })
//       .catch(() => {});
//     throw error;
//   } finally {
//     await docker.getVolume(volumeName).remove().catch(() => {});
//   }

//   return { success: true };
// }

// const worker = new Worker(
//   "pipeline-queue",
//   async (job) => {
//     console.log(`[Worker] Processing job ${job.id}`);

//     const timeoutPromise = new Promise((_, reject) =>
//       setTimeout(() => reject(new Error("PIPELINE_TIMEOUT")), PIPELINE_TIMEOUT_MS)
//     );

//     try {
//       return await Promise.race([processRun(job), timeoutPromise]);
//     } catch (error) {
//       if (error.message === "PIPELINE_TIMEOUT") {
//         await prisma.pipelineRun
//           .update({
//             where: { id: job.data.runId },
//             data: { status: "FAILED", completedAt: new Date() },
//           })
//           .catch(() => {});
//         await pub(job.data.runId, {
//           type: "RUN_COMPLETED",
//           status: "FAILED",
//           runId: job.data.runId,
//           error: "Pipeline exceeded time limit",
//         });
//         throw new UnrecoverableError("Pipeline exceeded time budget");
//       }
//       throw error;
//     }
//   },
//   { connection: workerConnection, concurrency: 3 }
// );

// worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
// worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));
// worker.on("error", (err) => console.error(`[Worker] Worker error: ${err.message}`));

// process.on("uncaughtException", (err) => console.error("[Worker] UNCAUGHT:", err));
// process.on("unhandledRejection", (reason) => console.error("[Worker] UNHANDLED:", reason));

// console.log("Pipeline worker started...");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const { createBullMQConnection, createRedisConnection } = require("../../config/redis");
const executeStep = require("../../utils/executeStep");
const prisma = require("../../lib/prisma");
const Docker = require("dockerode");
const { Worker, UnrecoverableError } = require("bullmq");

const docker = new Docker();
const workerConnection = createBullMQConnection();
const publisher = createRedisConnection();

const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000;

async function pub(runId, payload) {
  await publisher.publish(`run:${runId}`, JSON.stringify(payload));
}

async function cloneRepo(repoUrl, branch, volumeName, runId, stepId) {
  let container;
  console.log("[Worker] Started cloning...");

  const collectedLines = [];

  const emit = async (message) => {
    collectedLines.push(message);
    await pub(runId, { type: "log", stepId, stepName: "Clone repository", message });
  };

  await emit(`$ git clone --branch ${branch} --depth 1 ${repoUrl} /workspace`);

  try {
    container = await docker.createContainer({
      Image: "alpine/git",
      Cmd: ["clone", "--branch", branch, "--depth", "1", repoUrl, "/workspace"],
      Tty: false,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: { Binds: [`${volumeName}:/workspace`] },
    });

    const stream = await container.attach({ stream: true, stdout: true, stderr: true});
    await container.start();

    const lineBuffer = { data: "" };
    stream.on("data", (chunk) => {
      let offset = 0;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      while (offset < buf.length) {
        if (buf.length - offset < 8) break;
        const size = buf.readUInt32BE(offset + 4);
        const payload = buf.slice(offset + 8, offset + 8 + size).toString("utf8");
        lineBuffer.data += payload;
        const lines = lineBuffer.data.split("\n");
        lineBuffer.data = lines.pop();
        for (const line of lines) {
          const trimmed = line.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trimEnd();
          if (trimmed) emit(trimmed);
        }
        offset += 8 + size;
      }
    });

    const result = await container.wait();

    if (lineBuffer.data.trim()) {
      await emit(lineBuffer.data.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim());
    }

    if (result.StatusCode !== 0) {
      await emit(`✗ Clone failed with exit code ${result.StatusCode}`);
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: { cloneLogs: collectedLines.join("\n") },
      }).catch(() => {});
      throw new Error(`Repository clone failed (exit ${result.StatusCode})`);
    }

    await emit("✓ Repository cloned successfully");
    console.log("[Worker] Cloned repo successfully");

    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { cloneLogs: collectedLines.join("\n") },
    });

  } finally {
    if (container) await container.remove({ force: true }).catch(() => {});
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

  try {
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const cloneStepId = `clone-${runId}`;
    await pub(runId, { type: "step_start", stepId: cloneStepId, stepName: "Clone repository", order: 0 });
    await cloneRepo(run.pipeline.repoUrl, run.pipeline.branch, volumeName, runId, cloneStepId);
    await pub(runId, { type: "step_end", stepId: cloneStepId, stepName: "Clone repository", status: "SUCCESS" });

    for (const step of run.steps) {
      if (step.status === "SUCCESS") continue;
      console.log(`[Worker] Running step: ${step.name}`);

      await prisma.pipelineStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      await pub(runId, {
        type: "step_start",
        stepId: step.id,
        stepName: step.name,
        order: step.order,
        image: step.image,
        command: step.command,
      });

      const result = await executeStep(step, volumeName, async (line) => {
        await pub(runId, { type: "log", stepId: step.id, stepName: step.name, message: line });
      });

      if (result.exitCode !== 0) {
        await prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: "FAILED", logs: result.logs, completedAt: new Date() },
        });
        await prisma.pipelineRun.update({
          where: { id: runId },
          data: { status: "FAILED", completedAt: new Date() },
        });
        await pub(runId, { type: "step_end", stepId: step.id, stepName: step.name, status: "FAILED", exitCode: result.exitCode });
        await pub(runId, { type: "RUN_COMPLETED", status: "FAILED", runId, error: `Step "${step.name}" failed with exit code ${result.exitCode}` });
        throw new Error(`Step "${step.name}" failed with exit code ${result.exitCode}`);
      }

      await prisma.pipelineStep.update({
        where: { id: step.id },
        data: { status: "SUCCESS", logs: result.logs, completedAt: new Date() },
      });

      await pub(runId, { type: "step_end", stepId: step.id, stepName: step.name, status: "SUCCESS", exitCode: 0 });
      console.log(`[Worker] Step "${step.name}" succeeded`);
    }

    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: "SUCCESS", completedAt: new Date() },
    });

    await pub(runId, { type: "RUN_COMPLETED", status: "SUCCESS", runId });
    console.log(`[Worker] Run ${runId} completed successfully`);
  } catch (error) {
    await prisma.pipelineRun
      .update({ where: { id: runId }, data: { status: "FAILED", completedAt: new Date() } })
      .catch(() => {});
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
      setTimeout(() => reject(new Error("PIPELINE_TIMEOUT")), PIPELINE_TIMEOUT_MS)
    );
    try {
      return await Promise.race([processRun(job), timeoutPromise]);
    } catch (error) {
      if (error.message === "PIPELINE_TIMEOUT") {
        await prisma.pipelineRun
          .update({ where: { id: job.data.runId }, data: { status: "FAILED", completedAt: new Date() } })
          .catch(() => {});
        await pub(job.data.runId, { type: "RUN_COMPLETED", status: "FAILED", runId: job.data.runId, error: "Pipeline exceeded time limit" });
        throw new UnrecoverableError("Pipeline exceeded time budget");
      }
      throw error;
    }
  },
  { connection: workerConnection, concurrency: 3 }
);

worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));
worker.on("error", (err) => console.error(`[Worker] Worker error: ${err.message}`));

process.on("uncaughtException", (err) => console.error("[Worker] UNCAUGHT:", err));
process.on("unhandledRejection", (reason) => console.error("[Worker] UNHANDLED:", reason));

console.log("Pipeline worker started...");