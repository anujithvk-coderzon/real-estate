import express from "express";
import {
  accountVerification,
  change_password,
  forgot_password,
  login,
  logout,
  me,
  register,
  reset_password,
  rotateAccessToken,
} from "./auth.controller.js";
import { isAuthorized } from "../../middlewares/jwtTokens.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { changePassLimiter, forgotPassEmailLimiter, forgotPassIPLimiter, loginIpLimiter, registerIpLimiter, RegisterLoginemailLimiter } from "../../lib/rateLimiter.js";

const router = express.Router();

router.post("/register",rateLimit(registerIpLimiter),rateLimit(RegisterLoginemailLimiter),register);
router.post("/verify/:token",accountVerification);
router.post("/login",rateLimit(loginIpLimiter),rateLimit(RegisterLoginemailLimiter),login);
router.post("/refresh", rotateAccessToken);
router.post("/logout", isAuthorized, logout);
router.post("/forgot",rateLimit(forgotPassIPLimiter),rateLimit(forgotPassEmailLimiter),forgot_password)
router.post("/reset/:token",reset_password)
router.patch("/change/password",isAuthorized,rateLimit(changePassLimiter),change_password)
router.get('/me',isAuthorized,me)
export default router;
