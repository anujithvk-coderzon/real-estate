import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { BadRequestError } from "../errors/Errors.js";

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

export const emailTokenVerification = async (token: string): Promise<EmailPayload> => {
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