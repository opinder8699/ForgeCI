const prisma = require("../../lib/prisma");
const parsePipeline = require("../../utils/parsePipeline.js");
const verifyGithubSignature = require("../../utils/verifyGithubSignature");
const pipelineQueue = require("../queue/pipeline.queue.js");

exports.githubWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];

    if (!signature || !verifyGithubSignature(req.body, signature)) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const event = req.headers["x-github-event"];

    if (event === "ping") {
      return res.status(200).json({
        success: true,
        message: "pong",
      });
    }

    if (event !== "push") {
      return res.status(200).json({
        success: true,
        message: "Event ignored",
      });
    }

    const payload = JSON.parse(req.body.toString());

    const repoUrl = payload.repository.html_url;

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        repoUrl,
      },
    });

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    const run = await prisma.pipelineRun.create({
      data: {
        pipelineId: pipeline.id,
      },
    });

    const parsedYaml = parsePipeline(pipeline.yamlConfig);

    const steps = parsedYaml.steps || [];

    await prisma.pipelineStep.createMany({
      data: steps.map((step, i) => ({
        runId: run.id,
        name: step.name,
        command: step.command,
        image: step.image,
        order: i + 1,
      })),
    });

    const job = await pipelineQueue.add("pipeline-run", {
      runId: run.id,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
