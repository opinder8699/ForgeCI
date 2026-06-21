const express = require("express");
const router = express.Router();
const auth=require("../../middlewares/auth.js")

const {
  createPipeline,
} = require("./pipeline.controller");

router.post("/",auth, createPipeline);

module.exports = router;