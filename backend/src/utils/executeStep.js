const docker = require("./docker.js");

async function executeStep(step, volumeName) {
  let container;

  try {
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
        NetworkDisabled: true,
        ReadonlyRootfs: false,
        Binds: [`${volumeName}:/workspace`],
      },
    });

    await container.start();

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start();
    const stdout = [];
    const stderr = [];
    docker.modem.demuxStream(
      stream,
      { write: (chunk) => stdout.push(chunk) },
      { write: (chunk) => stderr.push(chunk) },
    );

    let timeout;
    const executionPromise = new Promise((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
      timeout = setTimeout(async () => {
        try {
          await container.kill();
        } catch (e) {}
        reject(new Error("TIMEOUT"));
      }, 60000);
    });

    try {
      await executionPromise;
      clearTimeout(timeout);
    } catch (err) {
      if (err.message === "TIMEOUT") {
        return { logs: "Step timed out", exitCode: -1, timedOut: true };
      }
      throw err;
    }

    const output = Buffer.concat(stdout).toString();
    const errorOutput = Buffer.concat(stderr).toString();
    const result = await exec.inspect();

    return {
      logs: `${output}${errorOutput}`,
      exitCode: result.ExitCode,
    };
  } catch (err) {
    return { logs: `Step execution error: ${err.message}`, exitCode: -1 };
  } finally {
    if (container) {
      await container.remove({ force: true });
    }
  }
}

module.exports = executeStep;
