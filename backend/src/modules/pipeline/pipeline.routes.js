const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth.js");
const {
  createPipeline,
  getPipelines,
  getPipelineById,
  getPipelineRuns,
  triggerRun,
} = require("./pipeline.controller");

router.get("/", auth, getPipelines);
router.post("/", auth, createPipeline);
router.get("/:id", auth, getPipelineById);
router.get("/:id/runs", auth, getPipelineRuns);
router.post("/:id/runs", auth, triggerRun);

module.exports = router;
