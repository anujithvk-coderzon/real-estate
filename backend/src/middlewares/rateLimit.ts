import type { NextFunction, Request, Response } from "express";
import type { RateLimiterRedis } from "rate-limiter-flexible";


export const rateLimit=(limiter:RateLimiterRedis)=>{
return async(req:Request,res:Response,next:NextFunction)=>{
 try {
    await limiter.consume(req.ip ?? "unknown")
    next()
 } catch (err) {
    console.log(err)
    return res.status(429).json({message:"Too many requests"})
 }
}
}

