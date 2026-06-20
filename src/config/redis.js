const IORedis = require("ioredis");

function createConnection() {
  return new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  });
}

module.exports = createConnection;