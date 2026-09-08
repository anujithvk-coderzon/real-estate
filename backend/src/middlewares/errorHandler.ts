import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
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
  if (err instanceof MulterError) {
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "File too large. Maximum size is 30MB."
      : err.code === "LIMIT_FILE_COUNT"
        ? "Too many files. Maximum is 10."
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? `Unexpected field: ${err.field}`
          : "File upload failed";

  return res.status(400).json({ status: "error", message });
}
  return res
    .status(500)
    .json({ status: "error", message: "Internal Server Error" });
};
