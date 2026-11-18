// Must come first: src/lib/prisma.ts builds its pg Pool from
// process.env.DATABASE_URL at module load.
import "dotenv/config.js";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.js";

/**
 * Replaces everything in `places` with the corrected data set, in ONE
 * transaction. If anything fails - including the check at the end that every
 * row actually landed - the transaction rolls back and the table is left
 * exactly as it was. There is no moment where the type-ahead sees a
 * half-written table.
 *
 * Why a replace and not `seed:places`: the seed only inserts and refreshes
 * aliases, so it can never remove a row. The corrected data deletes rows
 * (postal names that are not places), merges rows (one town stored twice) and
 * renames rows (Kerala -> Keralam, Cuttack -> Kataka); those leave the old rows
 * behind unless the table is rewritten.
 *
 * Existing listings and projects store state, district and city as plain
 * text, so after a rename they still say "Kerala" or "Quilandy". Pass
 * --remap-addresses to carry them over to the current names in the same
 * transaction. projects.reraState is never touched: it names a RERA
 * authority, not a place.
 *
 * Run:  npm run rewrite:places -- --dry-run            (report only, writes nothing)
 *       npm run rewrite:places                         (rewrite places)
 *       npm run rewrite:places -- --remap-addresses    (rewrite + update listings/projects)
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data", "india-places.json");
const REMAP = join(HERE, "data", "place-remap.json");
const CHUNK = 2000;

const dryRun = process.argv.includes("--dry-run");
const remapAddresses = process.argv.includes("--remap-addresses");

type PlaceRow = { city: string; aka?: string[] };
type Doc = { places: Record<string, Record<string, PlaceRow[]>> };
type Row = { state: string; district: string; city: string; aka: string[] };
type Key = { state?: string; district?: string; city?: string };
type Rule = { match: Key; set: Key };

const load = (): Row[] => {
  const doc = JSON.parse(readFileSync(DATA, "utf8")) as Doc;
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const [state, districts] of Object.entries(doc.places)) {
    for (const [district, list] of Object.entries(districts)) {
      for (const p of list) {
        const city = p.city.trim();
        // The unique index is on the exact strings, so fold case here or a
        // second spelling of one name would fail the whole transaction.
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
  return rows;
};

// Stored addresses were typed by people, so match them without regard to case.
const where = (m: Key) => ({
  ...(m.state ? { state: { equals: m.state, mode: "insensitive" as const } } : {}),
  ...(m.district ? { district: { equals: m.district, mode: "insensitive" as const } } : {}),
  ...(m.city ? { city: { equals: m.city, mode: "insensitive" as const } } : {}),
});

const describe = (k: Key) => [k.state, k.district, k.city].filter(Boolean).join(" / ");

const main = async () => {
  const rows = load();
  const rules = (JSON.parse(readFileSync(REMAP, "utf8")) as { rules: Rule[] }).rules;
  const before = await prisma.place.count();
  const states = new Set(rows.map((r) => r.state)).size;
  const districts = new Set(rows.map((r) => `${r.state}|${r.district}`)).size;
  const aliases = rows.reduce((n, r) => n + r.aka.length, 0);

  console.log(`places now in the database: ${before}`);
  console.log(
    `corrected data set:         ${rows.length} places, ${states} states/UTs, ` +
      `${districts} districts with places, ${aliases} aliases`,
  );

  // What --remap-addresses would change. Counted per rule against the data
  // as it stands, so it is a preview, not a promise: rules apply in order,
  // and a later rule can match a row an earlier one just changed.
  let listingHits = 0;
  let projectHits = 0;
  const examples: string[] = [];
  for (const r of rules) {
    const l = await prisma.listing.count({ where: where(r.match) });
    const p = await prisma.project.count({ where: where(r.match) });
    listingHits += l;
    projectHits += p;
    if ((l || p) && examples.length < 15)
      examples.push(`  ${describe(r.match)}  ->  ${JSON.stringify(r.set)}  (${l} listings, ${p} projects)`);
  }
  console.log(
    `\nstored addresses that use an old name: ${listingHits} listings, ${projectHits} projects` +
      (remapAddresses ? " - will be updated" : " - left as they are (pass --remap-addresses to update them)"),
  );
  for (const e of examples) console.log(e);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const t0 = Date.now();
  await prisma.$transaction(
    async (tx) => {
      const { count: deleted } = await tx.place.deleteMany({});
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { count } = await tx.place.createMany({ data: rows.slice(i, i + CHUNK) });
        inserted += count;
      }

      // Verify before committing. A count can be right while rows are wrong,
      // so also read back a spread of rows and compare them field by field.
      const total = await tx.place.count();
      if (total !== rows.length) throw new Error(`expected ${rows.length} rows, table has ${total}`);
      const step = Math.max(1, Math.floor(rows.length / 400));
      for (let i = 0; i < rows.length; i += step) {
        const want = rows[i]!;
        const got = await tx.place.findUnique({
          where: { state_district_city: { state: want.state, district: want.district, city: want.city } },
          select: { aka: true },
        });
        if (!got) throw new Error(`row did not land: ${describe(want)}`);
        if ([...got.aka].sort().join("|") !== [...want.aka].sort().join("|"))
          throw new Error(`aliases differ for ${describe(want)}`);
      }

      let movedListings = 0;
      let movedProjects = 0;
      if (remapAddresses) {
        for (const r of rules) {
          movedListings += (await tx.listing.updateMany({ where: where(r.match), data: r.set })).count;
          movedProjects += (await tx.project.updateMany({ where: where(r.match), data: r.set })).count;
        }
      }
      console.log(`\ndeleted ${deleted}, inserted ${inserted}, verified ${total} rows`);
      if (remapAddresses) console.log(`updated ${movedListings} listings and ${movedProjects} projects`);
    },
    // A 151k-row rewrite takes far longer than the 5-second default.
    { timeout: 15 * 60_000, maxWait: 30_000 },
  );
  console.log(`committed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const byState = await prisma.place.groupBy({
    by: ["state"],
    _count: { _all: true },
    orderBy: { state: "asc" },
  });
  for (const s of byState) console.log(`  ${s.state.padEnd(42)} ${s._count._all}`);
};

main()
  .catch((e) => {
    console.error("\nrolled back - the places table is unchanged.\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
