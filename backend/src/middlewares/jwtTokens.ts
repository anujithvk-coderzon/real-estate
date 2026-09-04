import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { BadRequestError } from "../errors/Errors.js";
import type { NextFunction, Request, Response } from "express";
import type { AuthPayload } from "../types/express.js";

interface EmailPayload extends JWTPayload {
  id: string;
}

export const generateEmailToken = async (userId: string) => {
  const key = new TextEncoder().encode(process.env.EMAIL_JWT_SECRET);
  const token = await new SignJWT({ id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(key);
  return token;
};

export const emailTokenVerification = async (
  token: string,
): Promise<EmailPayload> => {
  const key = new TextEncoder().encode(process.env.EMAIL_JWT_SECRET);
  try {
    const { payload } = await jwtVerify<EmailPayload>(token, key, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED")
      throw new BadRequestError("This verification link has expired.");
    throw new BadRequestError("Invalid verification link.");
  }
};

export const generateAccessToken = async (userId: string) => {
  const secret = process.env.ACCESS_JWT_SECRET;
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ id: userId })
    .setExpirationTime("15m")
    .setProtectedHeader({ alg: "HS256" })
    .sign(key);
  return token;
};

export const generateRefreshToken = async (userId: string) => {
  const secret = process.env.REFRESH_JWT_SECRET;
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ id: userId })
    .setExpirationTime("7d")
    .setProtectedHeader({ alg: "HS256" })
    .sign(key);
  return token;
};

export const refreshTokenVerification = async (token: string) => {
  const secret = process.env.REFRESH_JWT_SECRET;
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload;
};

export const accessTokenVerification = async (token: string) => {
  const secret = process.env.ACCESS_JWT_SECRET;
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as AuthPayload;
};

export const isAuthorized = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payload = await accessTokenVerification(token as string);
    req.user = payload;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Invalid Token" });
  }
};
