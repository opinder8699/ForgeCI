const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRouter = require("./src/modules/auth/auth.routes.js");
const pipelineRoutes = require("./src/modules/pipeline/pipeline.routes");
const webhookRouter = require("./src/modules/webhook/webhook.routes.js");
const runsRouter = require("./src/modules/runs/runs.routes.js");
const bullBoard = require("./src/modules/bullboard/bullBoard");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", FRONTEND_URL, "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
        frameSrc: ["'self'", FRONTEND_URL],
      },
    },
  }),
);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:3000",
    ].filter(Boolean),
    credentials: true,
  }),
);

app.use(cookieParser());

app.use("/api/webhooks", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(morgan("dev"));

app.use("/api/auth", authRouter);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/webhooks", webhookRouter);
app.use("/api/runs", runsRouter);
app.use("/admin/queues", bullBoard.getRouter());

module.exports = app;
