const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth.js");
const { getRunById, getRunLogs, deleteRun } = require("./runs.controller");

router.get("/:id", auth, getRunById);
router.get("/:id/logs", auth, getRunLogs);
router.delete("/:id", auth, deleteRun);

module.exports = router;