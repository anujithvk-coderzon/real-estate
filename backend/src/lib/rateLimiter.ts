import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import redis from "./redis.js";

const FLOOD_WINDOW = 60;
const FLOOD_BLOCK = 60;

export const registerIpLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:register',
  points: 60,
  duration: FLOOD_WINDOW,
  blockDuration: FLOOD_BLOCK,
  insuranceLimiter: new RateLimiterMemory ({
    points: 60,
    duration: FLOOD_WINDOW,
    blockDuration: FLOOD_BLOCK,
  }),
});

export const loginIpLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:'rl:login',
  points: 120,
  duration: FLOOD_WINDOW,
  blockDuration: FLOOD_BLOCK,
  insuranceLimiter: new RateLimiterMemory ({
    points: 120,
    duration: FLOOD_WINDOW,
    blockDuration: FLOOD_BLOCK,
  }),
});

export const forgotPassIPLimiter=new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:forgotPass',
  points:30,
  duration: FLOOD_WINDOW,
  blockDuration: FLOOD_BLOCK,
  insuranceLimiter: new RateLimiterMemory ({
    points: 30,
    duration: FLOOD_WINDOW,
    blockDuration: FLOOD_BLOCK,
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

export const contactRevealLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:contactReveal',
  points:20,
  duration:24*60*60,
  insuranceLimiter:new RateLimiterMemory({
    points:20,
    duration:24*60*60
  })
})

export const mediaUploadLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:mediaUpload',
  points:40,
  duration:60*60,
  blockDuration:5*60,
  insuranceLimiter:new RateLimiterMemory({
    points:40,
    duration:60*60,
    blockDuration:5*60
  })
})

export const videoUploadLimiter=new RateLimiterRedis({
   storeClient:redis,
  keyPrefix:'rl:videoUpload',
  points:10,
  duration:60*60,
  blockDuration:5*60,
  insuranceLimiter:new RateLimiterMemory({
    points:10,
    duration:60*60,
    blockDuration:5*60
  })
})

export const msgChatLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:chatMsg',
  points:60,
  duration:60,
  insuranceLimiter:new RateLimiterMemory({
    points:60,
    duration:60
  })
})

export const complaintLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:complaint',
  points:5,
  duration:24*60*60,
  insuranceLimiter:new RateLimiterMemory({
    points:5,
    duration:24*60*60
  })
})

export const catalogueLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:catalogue',
  points:300,
  duration:300,
  insuranceLimiter:new RateLimiterMemory({
    points:300,
    duration:300
  })
})

export const chatStartLimiter=new RateLimiterRedis({
  storeClient:redis,
  keyPrefix:'rl:chatStart',
  points:20,
  duration:60*60,
  insuranceLimiter:new RateLimiterMemory({
    points:20,
    duration:60*60
  })
})