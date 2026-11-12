import type { NextFunction, Request, Response } from "express";
import type { RateLimiterRedis } from "rate-limiter-flexible";


const retryAfterText = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours === 0 && minutes === 0) return `${seconds}s`;
  if (hours === 0) return `${minutes}m:${seconds}s`;
  return `${hours}h:${minutes}m`;
};

export const rateLimit = (limiter: RateLimiterRedis) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = req.body?.email ?? "unknown";
    const userId = req.user?.id ?? "unknown";
    const ip = req.ip ?? "unknown";
    let key = `${userId}`;
    if (limiter.keyPrefix === "rl:register") key = `${ip}`;
    if (limiter.keyPrefix === "rl:login") key = `${ip}`;
    if (limiter.keyPrefix === "rl:forgotPass") key = `${ip}`;
    if (limiter.keyPrefix === "rl:forgotEmail") key = `${email}`;
    if (limiter.keyPrefix === "rl:email") key = `${email}`;
    if (limiter.keyPrefix === "rl:catalogue") key = req.user?.id ?? `ip:${ip}`;

    try {
      await limiter.consume(key);
      next();
    } catch (err) {
      const wait = (err as { msBeforeNext?: unknown })?.msBeforeNext;

      if (typeof wait !== "number" || !Number.isFinite(wait)) {
        console.error("[rateLimit] limiter unavailable", err);
        return res.status(503).json({
          message: "We cannot check that right now. Try again in a moment.",
        });
      }
      const seconds = Math.max(1, Math.ceil(wait / 1000));
      console.warn(`[rateLimit] ${limiter.keyPrefix} blocked ${key} for ${seconds}s`);
      res.setHeader("Retry-After", seconds);
      return res.status(429).json({
        message: `Too many attempts. Try again after ${retryAfterText(seconds)}`,
        retryAfter: seconds,
      });
    }
  };
};
