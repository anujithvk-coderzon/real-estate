import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError, UnauthorizedError } from "../errors/Errors.js";


export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const id = req.user?.id;
  if (!id) throw new UnauthorizedError("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new ForbiddenError("Not allowed");

  next();
};
