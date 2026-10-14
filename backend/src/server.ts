import "dotenv/config.js";

import app from "./app.js";
import { redisConnect } from "./lib/redis.js";

const PORT = process.env.PORT || 5001;
await redisConnect();

const server=app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

let closing = false;

const shutdown = async (signal: string) => {
  if (closing) return;
  closing = true;
  console.log(`[server] ${signal} received, finishing in-flight requests…`);
  const forceExit = setTimeout(() => {
    console.error("[server] shutdown timed out, forcing exit");
    process.exit(1);
  }, 8000);
  forceExit.unref();
  server.close(() => {
    clearTimeout(forceExit);
    console.log("[server] closed cleanly");
    process.exit(0);
  });
  server.closeIdleConnections();
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));