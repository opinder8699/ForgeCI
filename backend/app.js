const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser"); 

const authRouter = require("./src/modules/auth/auth.routes.js");
const pipelineRoutes = require("./src/modules/pipeline/pipeline.routes");
const webhookRouter = require("./src/modules/webhook/webhook.routes.js");
const bullBoard = require("./src/modules/bullboard/bullBoard");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true, // required — browser must send the httpOnly JWT cookie cross-origin
  })
);

app.use(cookieParser());

app.use("/webhooks", express.raw({ type: "application/json" }));

app.use(express.json());

app.use(morgan("dev"));

app.use("/api/auth", authRouter);

app.use("/api/pipelines", pipelineRoutes);

app.use("/api/webhooks", webhookRouter);

app.use("/admin/queues", bullBoard.getRouter());

module.exports = app;
