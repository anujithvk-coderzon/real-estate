import type { Request, Response } from "express";
import { BadRequestError } from "../../errors/Errors.js";
import {
  citiesService,
  districtsService,
  statesService,
} from "./place.service.js";

const MAX_Q = 60;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, MAX_Q) : "";

const limit = (value: unknown, fallback: number, ceiling: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, ceiling) : fallback;
};

export const getStates = async (req: Request, res: Response) => {
  const states = await statesService(text(req.query.q), limit(req.query.limit, 5, 20));
  return res.status(200).json({ states });
};

export const getDistricts = async (req: Request, res: Response) => {
  const state = text(req.query.state);
  if (!state) throw new BadRequestError("State is required");
  const districts = await districtsService(
    state,
    text(req.query.q),
    limit(req.query.limit, 5, 20),
  );
  return res.status(200).json({ districts });
};

export const getCities = async (req: Request, res: Response) => {
  const state = text(req.query.state);
  const district = text(req.query.district);
  if (!state) throw new BadRequestError("State is required");
  if (!district) throw new BadRequestError("District is required");
  const cities = await citiesService(
    state,
    district,
    text(req.query.q),
    limit(req.query.limit, 8, 25),
  );
  return res.status(200).json({ cities });
};
