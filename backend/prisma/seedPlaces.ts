
import "dotenv/config.js";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.js";


const DATA = join(dirname(fileURLToPath(import.meta.url)), "data", "india-places.json");
const CHUNK = 2000;

type Doc = { places: Record<string, Record<string, { city: string; aka?: string[] }[]>> };

const main = async () => {
  const doc = JSON.parse(readFileSync(DATA, "utf8")) as Doc;
  const rows: { state: string; district: string; city: string; aka: string[] }[] = [];
  const seen = new Set<string>();
  for (const [state, districts] of Object.entries(doc.places)) {
    for (const [district, list] of Object.entries(districts)) {
      for (const p of list) {
        const city = p.city.trim();
        // The unique index is on the exact strings; fold case so two
        // spellings of one name cannot both be inserted.
        const key = `${state}|${district}|${city}`.toLowerCase();
        if (!city || seen.has(key)) continue;
        seen.add(key);
        const aka = [...new Set((p.aka ?? []).map((a) => a.trim()))].filter(
          (a) => a && a.toLowerCase() !== city.toLowerCase(),
        );
        rows.push({ state, district, city, aka });
      }
    }
  }

  const before = await prisma.place.count();
  console.log(`places in the database: ${before}; in the data file: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { count } = await prisma.place.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    inserted += count;
  }
  const after = await prisma.place.count();
  console.log(`inserted ${inserted}; places in the database now: ${after}`);
  if (after < rows.length) {
    throw new Error(`expected at least ${rows.length} places, found ${after}`);
  }
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
