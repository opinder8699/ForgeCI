const Docker = require("dockerode");
const docker = new Docker();

async function pullImage(imageName) {
  console.log(`[executeStep] Pulling image: ${imageName}`);

  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) {
        // Docker returns 404 for images that don't exist on the registry
        if (err.statusCode === 404 || err.message?.includes("not found") || err.message?.includes("No such image")) {
          return reject(
            new Error(
              `Image "${imageName}" not found on Docker Hub. ` +
              `Check the image name in your YAML (e.g. node:18-alpine, python:3.11-slim).`
            )
          );
        }
        return reject(new Error(`Failed to pull image "${imageName}": ${err.message}`));
      }

      // followProgress streams pull output and calls the callback when done
      docker.modem.followProgress(
        stream,
        (err) => {
          if (err) {
            return reject(new Error(`Image pull failed for "${imageName}": ${err.message}`));
          }
          console.log(`[executeStep] Image ready: ${imageName}`);
          resolve();
        },
        (event) => {
          // Log pull progress so worker console shows download activity
          if (event.status && event.progress) {
            process.stdout.write(`\r[executeStep] ${event.status}: ${event.progress}   `);
          }
        }
      );
    });
  });
}

async function executeStep(step, volumeName) {
  console.log(`[executeStep] Starting: "${step.name}", image: ${step.image}`);
  let container;

  try {
    // Auto-pull the image — if it's already local Docker skips download instantly.
    // If it doesn't exist on the registry, throws a clear error shown to the user.
    await pullImage(step.image);

    const cmd = ["sh", "-c", step.command];

    container = await docker.createContainer({
      Image: step.image,
      Cmd: ["sleep", "infinity"],
      WorkingDir: "/workspace",
      HostConfig: {
        Memory: 100 * 1024 * 1024,
        MemorySwap: 100 * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        PidsLimit: 50,
        ReadonlyRootfs: false,
        Binds: [`${volumeName}:/workspace`],
      },
    });

    console.log(`[executeStep] Container created`);
    await container.start();
    console.log(`[executeStep] Container started`);

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    console.log(`[executeStep] Exec created, running command...`);
    const stream = await exec.start();

    const stdout = [];
    const stderr = [];
    docker.modem.demuxStream(
      stream,
      { write: (chunk) => stdout.push(chunk) },
      { write: (chunk) => stderr.push(chunk) }
    );

    let timeout;
    const executionPromise = new Promise((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
      timeout = setTimeout(async () => {
        try { await container.kill(); } catch {}
        reject(new Error("STEP_TIMEOUT"));
      }, 60000);
    });

    try {
      await executionPromise;
      clearTimeout(timeout);
    } catch (err) {
      if (err.message === "STEP_TIMEOUT") {
        return {
          logs: `Step "${step.name}" timed out after 60 seconds.`,
          exitCode: -1,
          timedOut: true,
        };
      }
      throw err;
    }

    const output = Buffer.concat(stdout).toString();
    const errorOutput = Buffer.concat(stderr).toString();
    const result = await exec.inspect();

    console.log(`[executeStep] Step "${step.name}" finished with exit code ${result.ExitCode}`);

    return {
      logs: `${output}${errorOutput}`.trim(),
      exitCode: result.ExitCode,
    };
  } catch (err) {
    console.error(`[executeStep] Error in step "${step.name}":`, err.message);

    // Surface the full error message so it gets saved to the DB
    // and shown to the user in the RunDetails log console
    return {
      logs: err.message,
      exitCode: -1,
    };
  } finally {
    if (container) {
      await container.remove({ force: true }).catch(() => {});
    }
  }
}

module.exports = executeStep;
