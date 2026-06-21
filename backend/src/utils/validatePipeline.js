function validatePipeline(config) {
  if (!config.name) {
    throw new Error("Pipeline name is required");
  }

  if (!Array.isArray(config.steps)) {
    throw new Error("Steps must be an array");
  }

  if (config.steps.length === 0) {
    throw new Error("At least one step is required");
  }

  config.steps.forEach((step, index) => {
    if (!step.name) {
      throw new Error(`Step ${index + 1}: name is required`);
    }

    if (!step.image) {
      throw new Error(`Step ${index + 1}: image is required`);
    }

    if (!step.command) {
      throw new Error(`Step ${index + 1}: command is required`);
    }
  });

  return true;
}

module.exports = validatePipeline;