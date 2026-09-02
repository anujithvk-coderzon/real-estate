import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error(err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
  }
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path[0],
      message: issue.message,
    }));
    return res.status(400).json({ message: "Validation Error", errors });
  }
  return res
    .status(500)
    .json({ status: "error", message: "Internal Server Error" });
};
