import { AlreadyExistError, BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { compare, hash } from "bcrypt";
import {
  emailTokenVerification,
  generateAccessToken,
  generateEmailToken,
  generateRefreshToken,
  refreshTokenVerification,
} from "../../middlewares/jwtTokens.js";
import redis from "../../lib/redis.js";
import { checkDisposableEmail } from "../../lib/disposible_email.js";
import { sendEmail } from "../../lib/email.js";
import { goolgeClient } from "../../lib/google.js";

type regValidation = {
  name: string;
  email: string;
  password: string;
};

type logValidation = {
  email: string;
  password: string;
};

export const registerService = async (validatedData: regValidation) => {
  const existing_user = await prisma.user.findUnique({
    where: { email: validatedData.email },
  });
  if (existing_user && existing_user?.isVerified)
    throw new AlreadyExistError("User with this email already exists");
  const redisTokenExists = await redis.get(
    `email_verification_token:${existing_user?.id}`,
  );
  if (redisTokenExists && existing_user && !existing_user?.isVerified) {
    const ttl = await redis.ttl(`email_verification_token:${existing_user.id}`);
    const minutes = Math.floor(ttl / 60);
    const seconds = ttl % 60;
    if (minutes === 0)
      return {
        status: 200,
        message: `Your account isn't verified yet. We've already sent a verification link to your email. verification link expires in ${seconds} seconds`,
      };
    return {
      status: 200,
      message: `Your account isn't verified yet. We've already sent a verification link to your email. verification link expires in ${minutes} minutes and ${seconds} seconds`,
    };
  }
  if (!redisTokenExists && existing_user && !existing_user?.isVerified) {
    const token = await generateEmailToken(existing_user.id);
    await redis.set(`email_verification_token:${existing_user.id}`, token, {
      expiration: { type: "EX", value: 900 },
    });
    const verification_link = `${process.env.FRONTEND_URL}/verify/${token}`;
    const html = `
  <h2>Verify your email</h2>

  <p>Thanks for registering with Real Estate App.</p>

  <p>Please click the button below to verify your account:</p>

  <a
    href="${verification_link}"
    style="
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    "
  >
    Verify Email
  </a>

  <p>This verification link will expire in 15 minutes.</p>

  <p>If you didn't create an account, you can safely ignore this email.</p>
`;
    await sendEmail(existing_user.email, "Verification Email", html);
    return {
      status: 200,
      message:
        "User already exists but not verified. Please check your email to verify your account",
    };
  }
  const isDisposable = await checkDisposableEmail(validatedData.email);
  console.log(isDisposable);
  
  if (isDisposable)throw new BadRequestError("Disposable email addresses are not allowed. Please use a valid email address.",);
  const hashedPassword = await hash(validatedData.password, 10);
  const user = await prisma.user.create({
    data: {
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
    },
  });
  const token = await generateEmailToken(user.id);
  await redis.set(`email_verification_token:${user.id}`, token, {
    expiration: { type: "EX", value: 900 },
  });
  const verification_link = `${process.env.FRONTEND_URL}/verify/${token}`;
  const html = `
  <h2>Verify your email</h2>

  <p>Thanks for registering with Real Estate App.</p>

  <p>Please click the button below to verify your account:</p>

  <a
    href="${verification_link}"
    style="
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    "
  >
    Verify 
  </a>

  <p>This verification link will expire in 15 minutes.</p>

  <p>If you didn't create an account, you can safely ignore this email.</p>
`;
  await sendEmail(user.email, "Verification Email", html);
  return {
    status: 201,
    message:
      "User registered successfully. Please check your email to verify your account",
  };
};

export const regVerification = async (token: string) => {
  const decrypted = await emailTokenVerification(token);
  const key = `email_verification_token:${decrypted.id}`;
  const existingToken = await redis.get(key);
  if (!existingToken || existingToken !== token)
    throw new BadRequestError("Invalid Token");
  await prisma.user.update({
    where: { id: decrypted.id },
    data: { isVerified: true },
  });
  await redis.del(key);
  return "Account verified successfully.";
};

export const loginService = async (validatedData: logValidation) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email,isVerified:true},
  });
  if (!existingUser) throw new BadRequestError("Invalid credentials");
  if (!existingUser.password) throw new BadRequestError("Invalid credentials");
  const isCorrectPassword = await compare(
    validatedData.password,
    existingUser.password,
  );
  if (!isCorrectPassword) throw new BadRequestError("Invalid credentials");
  const accessToken = await generateAccessToken(existingUser.id);
  const refreshToken = await generateRefreshToken(existingUser.id);
  await redis.set(`refresh_token:${existingUser.id}`, refreshToken,{
    expiration:{type:"EX",value:7*24*60*60}
  });
  return { accessToken, refreshToken };
};

export const googleLoginService=async(code:string)=>{
  const {tokens}=await goolgeClient.getToken(code);
  const ticket=await goolgeClient.verifyIdToken({
    idToken:tokens.id_token as string,
    audience:process.env.GOOGLE_CLIENT_ID as string
  })
  const google=ticket.getPayload();
  if(!google?.email||!google.email_verified) throw new BadRequestError("Google account has no verified email");
  const user=await prisma.user.upsert({
    where:{email:google.email},
    update:{googleId:google.sub,avatarUrl:google.picture ?? null,isVerified:true},
    create:{
      name:google.name ?? google.email,
      email:google.email,
      googleId:google.sub,
      avatarUrl:google.picture??null,
      isVerified:true
    }
  })
  const accessToken=await generateAccessToken(user.id);
  const refreshToken=await generateRefreshToken(user.id);
  await redis.set(`refresh_token:${user.id}`,refreshToken,{
    expiration:{type:'EX',value:7*24*60*60}
  })
  return{accessToken,refreshToken}
}

export const rotateService = async (token: string) => {
  const decoded = await refreshTokenVerification(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.id as string },
  });
  if (!user) throw new BadRequestError("Invalid Token");
  const redisTokenexist =await redis.get(`refresh_token:${user.id}`);
  if (!redisTokenexist|| redisTokenexist!==token ) throw new BadRequestError("Invalid Token");
  const accessToken = await generateAccessToken(user.id);
  return accessToken;
};

export const forgotPasswordService=async(email:string)=>{
   const GENERIC_MESSAGE =
    "If an account exists for that email, a reset link has been sent";
 const existing_user=await prisma.user.findUnique({where:{email}})
 if(!existing_user) return GENERIC_MESSAGE
 const token = await generateEmailToken(existing_user.id);
 await redis.set(`forgotPassword_verification_token:${existing_user.id}`, token, {
    expiration: { type: "EX", value: 900 },
  });
  const verification_link = `${process.env.FRONTEND_URL}/forgot/${token}`;
  const html = `
  <h2>Fogot your password</h2>

  <p>Please click the button below to reset your Password :</p>

  <a
    href="${verification_link}"
    style="
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    "
  >
    Verify 
  </a>

  <p>This verification link will expire in 15 minutes.</p>

  <p>If you didn't create an account, you can safely ignore this email.</p>
`;
 await sendEmail(email,'Forgot Password',html)
 return GENERIC_MESSAGE
}

export const resetPasswordService=async(newPassword:string,token:string)=>{
const payload=await emailTokenVerification(token)
const user=await prisma.user.findUnique({where:{id:payload.id}})
if(!user) throw new BadRequestError("Invalid link")
const redisToken=await redis.get(`forgotPassword_verification_token:${user.id}`)
if(!redisToken || redisToken!==token) throw new BadRequestError("Invalid link")
const hashedPassword=await hash(newPassword,10)
await prisma.user.update({where:{id:user.id},data:{password:hashedPassword}})
await redis.del(`forgotPassword_verification_token:${user.id}`)
return 'Password reset successfull'
}

export const passwordChangeService=async(userId:string,newPass:string,currentPass:string)=>{
 const existingUser=await prisma.user.findUnique({where:{id:userId}})
 if(!existingUser) throw new NotFoundError("User not found")
  if(!existingUser.password) throw new BadRequestError("Invalid credentials")
 const isSame=await compare(currentPass,existingUser.password)
 if(!isSame) throw new BadRequestError("Incorrect current password")
 const hashedNewPass=await hash(newPass,10)
 await prisma.user.update({where:{id:userId},data:{password:hashedNewPass}})
 return 'Password updated successfully'
}