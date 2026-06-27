require("dotenv").config();
const http = require("http");

const setupSocket = require("./src/socket/socket");

const app = require("./app");
const httpServer = http.createServer(app);
setupSocket(httpServer);

require("./src/modules/workers/pipeline.worker");

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
