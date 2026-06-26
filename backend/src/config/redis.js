const IORedis = require("ioredis");

// BullMQ requires maxRetriesPerRequest: null on its connections.
// Never reuse a BullMQ connection for pub/sub or regular commands.
function createBullMQConnection() {
  return new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
}

// Regular Redis connection — for pub/sub publishing, general commands.
// Does NOT have maxRetriesPerRequest: null (uses default IORedis retry logic).
function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
}

module.exports = { createBullMQConnection, createRedisConnection };