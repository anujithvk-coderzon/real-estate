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
  // A client that goes away mid-upload is not a server fault, and there is
  // nobody left to answer. multer raises a plain `Error: Request aborted`,
  // which matched none of the branches below and fell through to 500 Internal
  // Server Error — so a dropped photo upload showed up in the browser as a
  // backend crash, and in the log as a stack trace with no cause. That is what
  // made this class of failure unreadable.
  //
  // Writing to a destroyed socket throws in its own right, so this answers
  // nothing: it logs who went away and where, at warn, and stops.
  if (err?.message === "Request aborted" || req.destroyed || res.headersSent) {
    console.warn(
      `[abort] client went away during ${req.method} ${req.originalUrl}` +
        ` (${err?.message ?? "no message"})`,
    );
    return;
  }

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
      ? "File too large."
      : err.code === "LIMIT_FILE_COUNT"
        ? "Too many files in this request."
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? `Unexpected file, or too many files`
          : "File upload failed";

  return res.status(400).json({ status: "error", message });
}
  return res
    .status(500)
    .json({ status: "error", message: "Internal Server Error" });
};
