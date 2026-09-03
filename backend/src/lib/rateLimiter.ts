import { RateLimiterRedis } from "rate-limiter-flexible";
import redis from "./redis.js";

export const registerLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: 5,
  duration: 60,
  blockDuration: 60,
});

export const loginLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: 5,
  duration: 60,
  blockDuration: 60,
});
