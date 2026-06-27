const Docker = require("dockerode");
const docker = new Docker();

async function pullImage(imageName) {
  console.log(`[executeStep] Pulling image: ${imageName}`);

  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) {
        if (
          err.statusCode === 404 ||
          err.message?.includes("not found") ||
          err.message?.includes("No such image")
        ) {
          return reject(
            new Error(
              `Image "${imageName}" not found on Docker Hub. ` +
                `Check the image name in your YAML (e.g. node:18-alpine, python:3.11-slim).`,
            ),
          );
        }
        return reject(
          new Error(`Failed to pull image "${imageName}": ${err.message}`),
        );
      }

      docker.modem.followProgress(
        stream,
        (err) => {
          if (err)
            return reject(
              new Error(`Image pull failed for "${imageName}": ${err.message}`),
            );
          console.log(`[executeStep] Image ready: ${imageName}`);
          resolve();
        },
        (event) => {
          if (event.status && event.progress) {
            process.stdout.write(
              `\r[executeStep] ${event.status}: ${event.progress}   `,
            );
          }
        },
      );
    });
  });
}

/**
 * executeStep — runs one pipeline step inside a Docker container.
 *
 * @param {object} step        — { name, image, command }
 * @param {string} volumeName  — named Docker volume shared across steps
 * @param {function} onLog     — called with each line as it arrives (for live streaming)
 */
async function executeStep(step, volumeName, onLog) {
  console.log(`[executeStep] Starting: "${step.name}", image: ${step.image}`);
  let container;

  try {
    await pullImage(step.image);

    const cmd = ["sh", "-c", step.command];

    container = await docker.createContainer({
      Image: step.image,
      Cmd: ["sleep", "infinity"],
      WorkingDir: "/workspace",
      Tty: false, // ← ensure binary stream so demuxStream works correctly
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

    await container.start();

    const exec = await container.exec({
      Cmd: ["sh", "-c", step.command],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });
    const stream = await exec.start();

    const allLines = [];

    const lineBuffer = { stdout: "", stderr: "" };

    function flushLines(buffer, key) {
      const lines = buffer[key].split("\n");
      // Keep last partial line in the buffer
      buffer[key] = lines.pop();
      for (const line of lines) {
        const text = line.trimEnd();
        if (text) {
          allLines.push(text);
          if (onLog) onLog(text);
        }
      }
    }

    docker.modem.demuxStream(
      stream,
      {
        write: (chunk) => {
          lineBuffer.stdout += chunk.toString();
          flushLines(lineBuffer, "stdout");
        },
      },
      {
        write: (chunk) => {
          lineBuffer.stderr += chunk.toString();
          flushLines(lineBuffer, "stderr");
        },
      },
    );

    let timeout;
    const executionPromise = new Promise((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
      timeout = setTimeout(async () => {
        try {
          await container.kill();
        } catch {}
        reject(new Error("STEP_TIMEOUT"));
      }, 60000);
    });

    try {
      await executionPromise;
      clearTimeout(timeout);
    } catch (err) {
      if (err.message === "STEP_TIMEOUT") {
        const msg = `Step "${step.name}" timed out after 60 seconds.`;
        if (onLog) onLog(msg);
        return {
          logs: [...allLines, msg].join("\n"),
          exitCode: -1,
          timedOut: true,
        };
      }
      throw err;
    }

    if (lineBuffer.stdout.trim()) {
      allLines.push(lineBuffer.stdout.trim());
      if (onLog) onLog(lineBuffer.stdout.trim());
    }
    if (lineBuffer.stderr.trim()) {
      allLines.push(lineBuffer.stderr.trim());
      if (onLog) onLog(lineBuffer.stderr.trim());
    }

    const result = await exec.inspect();
    console.log(
      `[executeStep] "${step.name}" finished with exit code ${result.ExitCode}`,
    );

    return {
      logs: allLines.join("\n"),
      exitCode: result.ExitCode,
    };
  } catch (err) {
    console.error(`[executeStep] Error in step "${step.name}":`, err.message);
    if (onLog) onLog(`Error: ${err.message}`);
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
