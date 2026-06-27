const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth.js");
const {
  createPipeline,
  getPipelines,
  getPipelineById,
  getPipelineRuns,
  triggerRun,
  deletePipeline,
  updatePipeline,
  deleteRun,
} = require("./pipeline.controller");

router.get("/", auth, getPipelines);
router.post("/", auth, createPipeline);
router.get("/:id", auth, getPipelineById);
router.patch("/:id", auth, updatePipeline);
router.delete("/:id", auth, deletePipeline);
router.get("/:id/runs", auth, getPipelineRuns);
router.post("/:id/runs", auth, triggerRun);
router.delete("/:id/runs/:runId", auth, deleteRun);

module.exports = router;
