import type { NextFunction, Request, Response } from "express";
import { registerSchema } from "./auth.validation.js";
import { registerService, regVerification } from "./auth.services.js";
import { BadRequestError } from "../../errors/Errors.js";

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

export const accountVerification=async(req:Request,res:Response,_next:NextFunction)=>{
try {
  const {token}=req.params;
 if (!token || typeof token !== "string") {
    return res.status(400).json({
      message: "Invalid verification link",
    });
  }
const response=await regVerification(token)
return res.status(200).json({message:response})
} catch (err) {
   const code = (err as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") {
      throw new BadRequestError(
        "This verification link has expired. Please register again to get a new one.",
      );
    }
    throw new BadRequestError("Invalid verification link.");
  }
}

