const prisma = require("../../lib/prisma");
const parsePipeline = require("../../utils/parsePipeline");
const validatePipeline = require("../../utils/validatePipeline");
const registerWebhook = require("../../utils/registerWebhook.js");
const deleteWebhook = require("../../utils/deleteWebhook.js");
const { decrypt } = require("../../utils/encryption.js");

exports.createPipeline = async (req, res) => {
  try {
    const { repoUrl, yamlConfig } = req.body;

    const parsedConfig = parsePipeline(yamlConfig);

    validatePipeline(parsedConfig);

    const pipeline = await prisma.pipeline.create({
      data: {
        name: parsedConfig.name,
        repoUrl,
        yamlConfig,
        userId: req.user.userId,
      },
    });

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
    });

    const accessToken = decrypt(user.githubAccessToken);

    let webhookId = null;

    try {
      webhookId = await registerWebhook(repoUrl, accessToken);

      await prisma.pipeline.update({
        where: {
          id: pipeline.id,
        },
        data: {
          webhookId: String(webhookId),
        },
      });
    } catch (error) {
      if (webhookId) {
        try {
          await deleteWebhook(repoUrl, accessToken, webhookId);
        } catch (cleanupError) {
          // log it but don't throw — still need to delete pipeline
          console.error("Failed to delete webhook:", cleanupError.message);
        }
      }

      await prisma.pipeline.delete({
        where: {
          id: pipeline.id,
        },
      });

      throw error;
    }

    return res.status(201).json({
      success: true,
      pipeline,
    });
  } catch (error) {
    if (
      error.message.includes("Invalid YAML") ||
      error.message.includes("required")
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/pipelines
exports.getPipelines = async (req, res) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
    });

    
    const result = pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      repoUrl: p.repoUrl,
      createdAt: p.createdAt,
      lastRunStatus: p.runs[0]?.status ?? null,
      lastRunAt: p.runs[0]?.createdAt ?? null,
    }));

    return res.json({ pipelines: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/pipelines/:id
exports.getPipelineById = async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
    });

    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    return res.json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        repoUrl: pipeline.repoUrl,
        yamlConfig: pipeline.yamlConfig,
        lastRunStatus: pipeline.runs[0]?.status ?? null,
        lastRunAt: pipeline.runs[0]?.createdAt ?? null,
        createdAt: pipeline.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/pipelines/:id/runs
exports.getPipelineRuns = async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
    });

    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    const runs = await prisma.pipelineRun.findMany({
      where: { pipelineId: req.params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        branch: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Derive duration from startedAt/completedAt if available
    const result = runs.map((r) => ({
      ...r,
      durationSeconds:
        r.startedAt && r.completedAt
          ? Math.round((new Date(r.completedAt) - new Date(r.startedAt)) / 1000)
          : null,
    }));

    return res.json({ runs: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/pipelines/:id/runs  (manual trigger)
exports.triggerRun = async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
    });

    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    const parsedYaml = parsePipeline(pipeline.yamlConfig);
    const steps = parsedYaml.steps || [];

    const run = await prisma.pipelineRun.create({
      data: {
        pipelineId: pipeline.id,
        branch: req.body.branch ?? "main",
        steps: {
          create: steps.map((step, i) => ({
            name: step.name,
            command: step.command,
            image: step.image,
            order: i + 1,
          })),
        },
      },
    });

    await pipelineQueue.add("pipeline-run", { runId: run.id });

    return res.status(201).json({ run });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
