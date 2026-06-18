const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth.js");

const { githubLogin, githubCallback, me, logout } = require("./auth.controller");

router.get("/github", githubLogin);

router.get("/github/callback", githubCallback);

router.get("/me", auth, me);

router.post("/logout", auth, logout);

module.exports = router;
