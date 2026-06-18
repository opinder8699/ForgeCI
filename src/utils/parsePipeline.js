const yaml = require("js-yaml");

function parsePipeline(yamlContent) {
  try {
    return yaml.load(yamlContent);
  } catch (error) {
    throw new Error("Invalid YAML format");
  }
}

module.exports = parsePipeline;