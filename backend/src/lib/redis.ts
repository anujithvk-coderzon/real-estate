import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS || "redis://localhost:6379",
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("ready", () => {
  console.log("Redis is ready to use");
});

redis.on("end", () => {
  console.log("Redis connection closed");
});

export const redisConnect = async () => {
  await redis.connect();
};

export default redis;
