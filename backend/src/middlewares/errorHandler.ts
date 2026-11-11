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
  // Outside production, say what actually went wrong in the response body.
  //
  // "Internal Server Error" is the correct thing to send a stranger and the
  // wrong thing to send the person building this: it means every unknown
  // failure reaches the browser indistinguishable from every other, and the
  // cause is only in a terminal nobody is looking at. Gated on NODE_ENV so a
  // real deployment still says nothing.
  // In development the real message goes in `message`, not in a side field.
  // The frontend's error toast reads `data.message` and nothing else, so a
  // cause tucked into `detail` is a cause nobody sees without opening the
  // network tab. Production still says only "Internal Server Error".
  const dev = process.env.NODE_ENV !== "production";

  return res.status(500).json({
    status: "error",
    message: dev
      ? `${err?.name ?? "Error"}: ${err?.message ?? "no message"}`
      : "Internal Server Error",
  });
};
