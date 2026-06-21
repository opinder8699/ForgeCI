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
