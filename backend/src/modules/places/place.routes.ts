import { Router } from "express";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { catalogueLimiter } from "../../lib/rateLimiter.js";
import { getCities, getDistricts, getStates } from "./place.controller.js";

const router = Router();

// Public on purpose: the search filters need these before anyone signs in.
// Rate limited like the rest of the catalogue, since a type-ahead is the
// easiest endpoint on the site to hammer.
router.get("/states", rateLimit(catalogueLimiter), getStates);
router.get("/districts", rateLimit(catalogueLimiter), getDistricts);
router.get("/cities", rateLimit(catalogueLimiter), getCities);

export default router;
