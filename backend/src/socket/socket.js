const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { createRedisConnection } = require("../config/redis");
const prisma = require("../lib/prisma");

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
      ].filter(Boolean),
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // ── 1. Auth middleware — runs once per socket connection, before "connection" fires
  io.use((socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie;

      if (!rawCookies) {
        return next(new Error("No cookies sent"));
      }

      const parsed = cookie.parse(rawCookies);
      const token = parsed.token;

      if (!token) {
        return next(new Error("No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId; // attach to socket, same idea as req.user

      next(); // auth passed, allow connection
    } catch (err) {
      next(new Error("Invalid token")); // auth failed, connection rejected
    }
  });

  // ── 2. Handle connections — only reached if io.use() called next() with no error
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}, user: ${socket.userId}`);
    socket.on("watch-run", async (runId) => {
      const run = await prisma.pipelineRun.findUnique({
        where: { id: runId },
        include: { pipeline: true },
      });

      if (!run || run.pipeline.userId !== socket.userId) {
        socket.emit("error", "Not authorized to view this run");
        return;
      }

      socket.join(`run:${runId}`);
    });

    socket.on("unwatch-run", (runId) => {
      socket.leave(`run:${runId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // ── 3. One shared Redis subscriber connection, pattern-subscribes to all run channels
  const subscriber = createRedisConnection();
  subscriber.psubscribe("run:*");

  subscriber.on("pmessage", (pattern, channel, message) => {
    // channel looks like "run:abc-123-uuid"
    // forward the message only to sockets that joined this exact room
    io.to(channel).emit("log", JSON.parse(message));
  });

  return io;
}

module.exports = setupSocket;
