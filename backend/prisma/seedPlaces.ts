// Must come first: src/lib/prisma.ts builds its pg Pool from
// process.env.DATABASE_URL at module load, so the env has to be populated
// before that import is evaluated. Without this, pg silently falls back to
// its default port 5432 and the connection is refused.
import "dotenv/config.js";

import { createReadStream, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.js";

/**
 * Loads the all-India place list into `places`.
 *
 * Every row is attested by an official government source — the India Post
 * pincode directory (which supplies its own district) or the Census town
 * directory. Places appearing only in GeoNames or OpenStreetMap were dropped,
 * because nothing independent can check them: Nominatim is backed by OSM, so
 * it confirms OSM's own mistakes.
 *
 * District lists were verified state by state against government portals and
 * gazette notifications, which is why they do not match either bulk source —
 * India Post's District field claims Karnataka has 58 districts (it has 31).
 *
 * `aka` carries alternate and historical spellings, so a seller typing
 * "Bombay", "Madras", "Calcutta", "Bangalore", "Allahabad", "Trivandrum" or
 * "Tellicherry" still lands on the right row.
 *
 * Run:  npm run seed:places
 *       npm run seed:places -- --reset          (delete every row first)
 *       npm run seed:places -- --state Kerala   (one state only)
 *       npm run seed:places -- --file <path>    (a different data file)
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(HERE, "data", "india-places.json");
const CHUNK = 2000;

type PlaceRow = { city: string; tier: string; aka: string[]; src: string[] };
type PlacesFile = {
  country?: string;
  places: Record<string, Record<string, PlaceRow[]>>;
};

type Row = { state: string; district: string; city: string; aka: string[] };

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const build = (file: string, onlyState?: string) => {
  const doc = JSON.parse(readFileSync(file, "utf8")) as PlacesFile;
  const rows: Row[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const [state, districts] of Object.entries(doc.places)) {
    if (onlyState && state.toLowerCase() !== onlyState.toLowerCase()) continue;
    for (const [district, list] of Object.entries(districts)) {
      for (const p of list) {
        const city = (p.city ?? "").trim();
        if (!city) {
          skipped++;
          continue;
        }
        // The @@unique is on the exact strings, so fold case here or two
        // spellings of one name would both insert.
        const key = `${state.toLowerCase()}|${district.toLowerCase()}|${city.toLowerCase()}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        rows.push({
          state,
          district,
          city,
          aka: [...new Set((p.aka ?? []).map((a) => a.trim()))].filter(
            (a) => a && a.toLowerCase() !== city.toLowerCase(),
          ),
        });
      }
    }
  }
  return { rows, skipped };
};

const main = async () => {
  const file = arg("--file") ?? DEFAULT_FILE;
  const onlyState = arg("--state");
  const reset = process.argv.includes("--reset");

  if (!existsSync(file)) {
    throw new Error(`data file not found: ${file}`);
  }

  const { rows, skipped } = build(file, onlyState);
  const states = new Set(rows.map((r) => r.state)).size;
  const districts = new Set(rows.map((r) => `${r.state}|${r.district}`)).size;
  console.log(
    `prepared ${rows.length} places — ${states} states/UTs, ${districts} districts` +
      (skipped ? `, ${skipped} skipped as blank or duplicate` : ""),
  );
  if (!rows.length) throw new Error("nothing to load — check --state spelling");

  if (reset) {
    const { count } = await prisma.place.deleteMany({});
    console.log(`--reset: deleted ${count} existing rows`);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { count } = await prisma.place.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    inserted += count;
    if ((i / CHUNK) % 10 === 0 || i + CHUNK >= rows.length) {
      console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length} …`);
    }
  }
  console.log(`inserted ${inserted} new rows`);

  // createMany skips rows that already exist, so it never refreshes `aka`.
  // Push the alias lists over explicitly — only the rows that have any.
  const withAka = rows.filter((r) => r.aka.length > 0);
  let synced = 0;
  for (const r of withAka) {
    const { count } = await prisma.place.updateMany({
      where: { state: r.state, district: r.district, city: r.city },
      data: { aka: r.aka },
    });
    synced += count;
  }
  console.log(`refreshed aka on ${synced}/${withAka.length} places`);

  const total = await prisma.place.count();
  const byState = await prisma.place.groupBy({
    by: ["state"],
    _count: { _all: true },
    orderBy: { _count: { state: "desc" } },
  });
  console.log(`\n${total} places in the database`);
  for (const s of byState) {
    console.log(`  ${s.state.padEnd(42)} ${s._count._all}`);
  }
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
