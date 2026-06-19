const express = require("express");

const {
  githubWebhook,
} = require("./webhook.controller");

const router = express.Router();

router.post(
  "/github",
  githubWebhook
);

module.exports = router;