import type { NextFunction, Request, Response } from "express";
import { changePasswordSchema, forgotSchema, loginSchema, profileSchema, registerSchema, resetSchema, setPasswordSchema } from "./auth.validation.js";
import {
  forgotPasswordService,
  googleLoginService,
  imageService,
  loginService,
  passwordChangeService,
  registerService,
  regVerification,
  resetPasswordService,
  rotateService,
  setPasswordService,
  updateProfileService,
} from "./auth.service.js";
import { BadRequestError, UnauthorizedError } from "../../errors/Errors.js";
import redis from "../../lib/redis.js";
import { prisma } from "../../lib/prisma.js";
import { goolgeClient } from "../../lib/google.js";
import { avatarPublicUrl } from "../../lib/bunny.js";

const isProduction = process.env.NODE_ENV === "production";
const REFRESH_COOKIE = "refresh_real_estate";
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;

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
  
  res.cookie(REFRESH_COOKIE, response.refreshToken, refreshCookieOptions);
  res
    .status(200)
    .json({ message: "Login successfull", accessToken: response.accessToken });
};

export const rotateAccessToken = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const token=req.cookies[REFRESH_COOKIE]
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
  const refreshToken=req.cookies[REFRESH_COOKIE]
  if (!userId || !refreshToken) {
    throw new UnauthorizedError("Unauthorized");
  }
  await redis.del(`refresh_token:${userId}`);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions); // same options, or the browser keeps it
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
  res.cookie(REFRESH_COOKIE, response.refreshToken, refreshCookieOptions);
 return res.status(200).json({message:response.message,accessToken:response.accessToken})
}

export const me = async (req: Request, res: Response) => {
  const result = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, avatarUrl: true, password: true },
  });
  if (!result) throw new UnauthorizedError("Unauthorized");
  const user={
   id:result.id,
   name:result.name,
   email:result.email,
   avatarUrl:avatarPublicUrl(result.avatarUrl),
   hasPassword:!!result.password
  }
  res.status(200).json({ message: "User fetched", user });
};

export const googleLogin=(req:Request,res:Response)=>{
  const url=goolgeClient.generateAuthUrl({
    scope:["openid","email","profile"],
    prompt:"select_account"
  })
  res.redirect(url)
}

export const googleCallback=async(req:Request,res:Response)=>{
  try {
    const response=await googleLoginService(req.query.code as string);
    res.cookie(REFRESH_COOKIE, response.refreshToken, refreshCookieOptions)
    res.redirect(process.env.FRONTEND_URL as string);
  } catch  {
    res.redirect(`${process.env.FRONTEND_URL}/auth/login`);
  }
}


export const set_password = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError("Unauthorized");
  const validated = setPasswordSchema.safeParse(req.body);
  if (!validated.success) throw validated.error;
  const response = await setPasswordService(userId, validated.data.new_password);
  res.cookie(REFRESH_COOKIE, response.refreshToken, refreshCookieOptions);
  return res.status(200).json({ message: response.message, accessToken: response.accessToken });
};

export const update_profile = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError("Unauthorized");
  const validated = profileSchema.safeParse(req.body);
  if (!validated.success) throw validated.error;
  const user = await updateProfileService(userId, validated.data);
  return res.status(200).json({ message: "Profile updated", user });
};

const AVATAR_TYPES=["image/jpeg","image/png","image/webp"]
const MAX_AVATAR_BYTES=10*1024*1024

// PATCH /auth/change/avatar — multipart, one file in the "avatar" field.
export const changeAvatar=async(req:Request,res:Response)=>{
  const id=req.user?.id
  if(!id) throw new UnauthorizedError("Unauthorized")
  const image=req.file
  if(!image) throw new BadRequestError("Choose an image to upload")
  // The shared multer setup also allows videos (for listings); a profile photo must be an image.
  if(!AVATAR_TYPES.includes(image.mimetype)) throw new BadRequestError("Profile photo must be JPG, PNG or WebP")
  if(image.size>MAX_AVATAR_BYTES) throw new BadRequestError("Profile photo must be under 10 MB")
  const {message,avatarUrl}=await imageService(id,image)
  return res.status(200).json({message,user:{avatarUrl}})
}