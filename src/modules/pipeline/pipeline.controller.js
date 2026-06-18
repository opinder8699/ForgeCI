const prisma = require("../../lib/prisma");
const parsePipeline = require("../../utils/parsePipeline");
const validatePipeline = require("../../utils/validatePipeline");

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

    return res.status(201).json({
      success: true,
      pipeline,
    });
  } catch (error) {
  if (error.message.includes("Invalid YAML") || 
      error.message.includes("required")) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
}
};