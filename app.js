const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRouter = require("./src/modules/auth/routes.js");

const app = express();

app.use(helmet());

app.use(cors());

app.use(cookieParser());

app.use(express.json());

app.use(morgan("dev"));

app.use("/auth", authRouter);

module.exports = app;
