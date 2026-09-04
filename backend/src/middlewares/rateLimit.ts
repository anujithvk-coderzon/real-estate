import type { NextFunction, Request, Response } from "express";
import type { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

export const rateLimit = (limiter: RateLimiterRedis) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      
      const email=req.body?.email ?? "unknown";
      const userId=req.user?.id ?? "unknown"
      const ip=req.ip ?? "unknown"
      let key=`${userId}`
      if(limiter.keyPrefix==='rl:register'){key=`${ip}`}
      if (limiter.keyPrefix === 'rl:login') { key = `${ip}` }
      if(limiter.keyPrefix==='rl:forgotPass'){key=`${ip}`}
      if(limiter.keyPrefix==='rl:forgotEmail'){key=`${email}`}
      if(limiter.keyPrefix==='rl:email'){key=`${email}`}
      await limiter.consume(key);
      next();
    } catch (err ) {
      const error=err as RateLimiterRes;
      if(err instanceof Error){
        console.log(error);
      }
      const totalSeconds=Math.ceil(error.msBeforeNext/1000)

      const hours=Math.floor(totalSeconds/3600)
      const minutes=Math.floor((totalSeconds%3600)/60)
      const  seconds=Math.floor(totalSeconds%60)

      if(hours===0&&minutes===0)  return res.status(429).json({message:"Too many requests. Try again after",retryAfter:seconds});
      if(hours===0&&minutes>0)   return res.status(429).json({message:"Too many requests. Try again after",retryAfter:`${minutes}m:${seconds}s`});
      if(hours>0) return res.status(429).json({message:"Too many requests. Try again after",retryAfter:`${hours}h:${minutes}m`});

      return res.status(429).json({ message: "Too many requests" });
    }
  };
};
