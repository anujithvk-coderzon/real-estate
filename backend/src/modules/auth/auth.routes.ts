import express from "express";
import { accountVerification, register } from "./auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify/:token",accountVerification)

export default router;
