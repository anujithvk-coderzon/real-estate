import type { NextFunction, Request, Response } from "express";
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from "./auth.validation.js";
import {
  forgotPasswordService,
  loginService,
  passwordChangeService,
  registerService,
  regVerification,
  resetPasswordService,
  rotateService,
} from "./auth.services.js";
import { BadRequestError, UnauthorizedError } from "../../errors/Errors.js";
import redis from "../../lib/redis.js";

export const register = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const validatedData = registerSchema.safeParse(req.body);
  if (!validatedData.success) throw validatedData.error;
  const response = await registerService(validatedData.data);
  return res.status(response.status).json({ message: response.message });
};

export const accountVerification = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({
        message: "Invalid verification link",
      });
    }
    const response = await regVerification(token);
    return res.status(200).json({ message: response });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") {
      throw new BadRequestError(
        "This verification link has expired. Please register again to get a new one.",
      );
    }
    throw new BadRequestError("Invalid verification link.");
  }
};

export const login = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const validated = loginSchema.safeParse(req.body);
  if (!validated.success) throw validated.error;
  const response = await loginService(validated.data);
  
  res.cookie("refresh_real_estate", response.refreshToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res
    .status(200)
    .json({ message: "Login successfull", accessToken: response.accessToken });
};

export const rotateAccessToken = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const token=req.cookies.refresh_real_estate
  if (!token || typeof token !== "string") {
    return res.status(400).json({
      message: "Invalid token",
    });
  }
  const response = await rotateService(token);
  res
    .status(200)
    .json({ message: "Tokan refreshed successfully", accessToken: response });
};

export const logout = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const userId = req.user?.id;
  const refreshToken=req.cookies.refresh_real_estate
  if (!userId || !refreshToken) {
    throw new UnauthorizedError("Unauthorized");
  }
  await redis.del(`refresh_token:${userId}`);
  res.clearCookie("refresh_real_estate");
  res.status(200).json({ message: "Logout successfull" });
};

export const forgot_password=async(req:Request,res:Response,_next:NextFunction)=>{
  const validated=forgotSchema.safeParse(req.body)
  if(!validated.success) throw validated.error;
  const response=await forgotPasswordService(validated.data.email)
  return res.status(200).json({message:response})
}
export const reset_password=async(req:Request,res:Response,_next:NextFunction)=>{
  const {token}=req.params
  if(!token) throw new BadRequestError("Invalid link")
  const validated=resetSchema.safeParse(req.body)
  if(!validated.success) throw validated.error
  const response=await resetPasswordService(validated.data.password,token as string)
  return res.status(200).json({message:response})
}

export const change_password=async(req:Request,res:Response,_next:NextFunction)=>{
 const userId=req.user?.id;
 if(!userId) throw new UnauthorizedError("Unauthorized")
 const validated=changePasswordSchema.safeParse(req.body)
 if(!validated.success) throw validated.error;
 const response=await passwordChangeService(userId,validated.data.new_password,validated.data.current_password)
 return res.status(200).json({message:response})
}