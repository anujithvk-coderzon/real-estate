import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import redis from "./redis.js";

export const registerIpLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:register',
  points: 50,
  duration: 10*60*60,
  blockDuration: 5*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 5,
    duration: 10*60*60,
    blockDuration: 5 * 60*60,
  }),

});

export const loginIpLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:login',
  points: 50,
  duration: 10*60*60,
  blockDuration: 5*60*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 50,
    duration: 10*60*60,
    blockDuration: 5 * 60*60,
  }),
});

export const forgotPassIPLimiter=new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:forgotPass',
  points:50,
  duration: 10*60*60,
  blockDuration: 5*60*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 50,
    duration: 10*6060,
    blockDuration: 5*60*60,
  }),
})

export const changePassLimiter=new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:changePass',
  points:3,
  duration: 60*60,
  blockDuration: 24*60*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 3,
    duration: 60*60,
    blockDuration: 3*60*60,
  }),
})

export const RegisterLoginemailLimiter=new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:email',
  points:5,
  duration:60,
  blockDuration:15*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 5,
    duration: 60,
    blockDuration: 15*60,
  }),
})

export const forgotPassEmailLimiter=new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:forgotEmail',
  points:3,
  duration:60,
  blockDuration:15*60,
  insuranceLimiter: new RateLimiterMemory ({
    points: 5,
    duration: 60,
    blockDuration: 15*60,
  }),
})