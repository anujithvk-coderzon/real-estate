import { AlreadyExistError, BadRequestError } from "../../errors/Errors.js";
import { prisma } from "../../lib/prisma.js";
import { hash } from "bcrypt";
import { emailTokenVerification, generateEmailToken } from "../../middlewares/jwtTokens.js";
import redis from "../../lib/redis.js";
import { checkDisposableEmail } from "../../lib/disposible_email.js";
import { sendEmail } from "../../lib/email.js";

type regValidation = {
  name: string;
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
  if (isDisposable)
    throw new BadRequestError(
      "Disposable email addresses are not allowed. Please use a valid email address.",
    );
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

export const regVerification=async(token:string):Promise<string>=>{
 const decrypted=await emailTokenVerification(token)
 const key=`email_verification_token:${decrypted.id}`
 const existingToken= await redis.get(key)
 if(!existingToken || existingToken!==token) throw new BadRequestError("Invalid Token")
 await prisma.user.update({where:{id:decrypted.id},data:{isVerified:true}})
 await redis.del(key)
 return 'Account verified successfully.'
}