import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/errorHandler.js";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./modules/auth/auth.routes.js";
import listRoutes from "./modules/listings/listing.routes.js"
const app = express();

app.use(helmet());
app.use(morgan("tiny"));
app.use(cors({origin: process.env.FRONTEND_URL,credentials:true}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/list", listRoutes)


app.use(errorHandler);

export default app;
