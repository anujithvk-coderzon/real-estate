/**
 * Fills place_names from the GeoNames India dataset.
 *
 * WHY A DATASET AND NOT A HAND-WRITTEN LIST
 * India has ~36 states, ~790 districts, ~8,000 towns and ~600,000 villages.
 * Typing those by hand guarantees invented names and misspelled real ones, and
 * a gazetteer full of plausible-looking fake places is worse than a small real
 * one: it silently "corrects" users to places that do not exist.
 *
 * GET THE DATA (two files, both free, CC-BY)
 *   https://download.geonames.org/export/dump/IN.zip                 (~16 MB)
 *   https://download.geonames.org/export/dump/alternatenames/IN.zip  (~1.4 MB)
 *
 * Both archives contain a file called IN.txt, so extract them into DIFFERENT
 * folders or the second will overwrite the first. (It did, to me.)
 *
 * RUN
 *   npx tsx src/scripts/importPlaces.ts <places.txt> [<alternateNames.txt>]
 *   npx tsx src/scripts/importPlaces.ts <places.txt> <alt.txt> --dry
 *
 * --dry parses and reports without touching the database. Always do that first.
 *
 * Re-running is safe: the table is emptied and rebuilt, because this script is
 * the only writer. That is also how you rebuild keys after changing
 * normalizePlaceName - which you MUST do, since every stored key was produced
 * by it and a stale key simply stops matching, with nothing in any log.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import process from "node:process";
import { prisma } from "../lib/prisma.js";
import { MIN_KEY_LENGTH, normalizePlaceName } from "../lib/placeNames.js";

/**
 * Which rows of the dataset are places a person would search for, and which
 * wins when two rows produce the same key. Lower tier wins; population breaks
 * ties inside a tier.
 *
 * The tiers are not cosmetic. "Rampur" exists as a town (pop 728,151) and as
 * an administrative district whose name in the data is literally "District
 * Rampur". Ranking on population alone picks the district, and then the string
 * sent to the geocoder is "District Rampur" - a worse query than the user's
 * own typo. Preferring populated places over administrative rows fixes it.
 *
 * Classes deliberately excluded: H (streams, canals), T (mountains, hills),
 * V (forests), R (roads), L (areas, reserves), and P.PPLQ / P.PPLW - abandoned
 * and destroyed settlements, which are real history and useless inventory.
 */
const TIER: Readonly<Record<string, number>> = {
  "P.PPLC": 10, // national capital
  "P.PPLA": 10, // state capital
  "P.PPLA2": 20, // district headquarters
  "P.PPLA3": 20,
  "P.PPLA4": 20,
  "P.PPLA5": 20,
  "P.PPL": 30, // town or village
  "P.PPLX": 30, // section of a city - where urban localities live
  "P.PPLL": 30,
  "P.PPLS": 30,
  "A.ADM1": 40, // state
  "A.ADM2": 40, // district
  "A.ADM3": 50, // taluk / tehsil
  "A.ADM4": 50,
  // Kept on purpose: "Edappally" and "Thalassery" exist in this dataset ONLY
  // as railway stations, and both are names people search for every day.
  "S.RSTN": 60,
};

/**
 * An alternate name ranks just below the row it belongs to - its parent's tier
 * plus this. It must NOT be a fixed worst rank, and the reason is a real bug
 * this script had:
 *
 * GeoNames carries a legacy row `Calicut` (P.PPL, population 0) alongside the
 * real `Kozhikode` (P.PPLA2, population 550,440). With alternate names ranked
 * last, the pop-0 legacy row won the key "calicut", so searching Calicut gave
 * the name "Calicut" back instead of "Kozhikode". The same happened to
 * "trichur" (a Trichūr taluk row) and "alleppey" (an Alleppey railway station).
 *
 * Inheriting the parent's tier makes an alias of a district headquarters
 * outrank a population-0 village, which is the answer a person wants.
 */
const ALT_TIER_PENALTY = 5;

/**
 * Alternate-name languages worth keeping: English, unlabelled, and Indian
 * languages. Everything else is dropped, and the reasons are specific:
 *
 *   "link"  13,232 rows of Wikipedia and authority-file URLs
 *   "wkdt"   6,174 Wikidata ids
 *   "abbr"   7,309 railway and airport codes - ZNH, ZNP, WB, WTR. Two to four
 *            letters, and they would hijack short queries. Checked a sample:
 *            almost none are names a person would type. If you want "blr" or
 *            "tvm", hand-write those - they are not in here.
 *   "post"   postal codes
 *   foreign  Russian, Chinese, Swedish names in their own scripts
 */
const ALT_LANGS: ReadonlySet<string> = new Set([
  "",
  "en",
  "ml",
  "hi",
  "ta",
  "kn",
  "te",
  "bn",
  "mr",
  "gu",
  "pa",
  "or",
  "as",
  "ur",
  "sa",
  "ne",
  "kok",
  "sd",
  "ks",
  "mai",
  "bho",
]);

/**
 * GeoNames writes administrative rows as "State of Kerala", "Union Territory
 * of Puducherry", "National Capital Territory of Delhi", "District Rampur",
 * "Thalassery Taluk". Nobody types those, and they are what gets sent to the
 * geocoder, so both ends need the qualifier removed.
 *
 * Only 198 of 7,742 administrative rows carry one, but those 198 include every
 * state in the country.
 */
const ADMIN_PREFIX =
  /^(?:state of|union territory of|national capital territory of|district|taluka|taluk|tehsil|mandal|subdistrict|sub-district|block)\s+/i;
const ADMIN_SUFFIX =
  /\s+(?:district|taluka|taluk|tehsil|mandal|subdistrict|sub-district|block)$/i;

const cleanDisplayName = (raw: string): string => {
  const stripped = raw
    .replace(ADMIN_PREFIX, "")
    .replace(ADMIN_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  // A place genuinely called "Block" would strip to nothing. Keep the original
  // rather than store an empty name.
  return stripped === "" ? raw.trim() : stripped;
};

type Entry = {
  /** The correct name we send to the geocoding API. */
  name: string;
  /** Lower wins. See TIER. */
  tier: number;
  /** Highest population seen for this key, across every row that produced it. */
  popularity: number;
};

/** Rows of the main file we kept, so alternate names can be attached to them. */
type Kept = { name: string; popularity: number; tier: number };

const readLines = (path: string) =>
  createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

/**
 * Records a key, keeping the better of what is already there and what arrived.
 *
 * name, tier and popularity move TOGETHER. An earlier version updated
 * popularity independently, taking the maximum across every row that produced
 * the key - which meant a population-0 village sharing a name with a city
 * inherited the city's popularity and then beat genuine candidates in fuzzy
 * ranking. The popularity stored must describe the place whose name we return,
 * or it is not a tie-breaker, it is a lie.
 */
const offer = (
  byKey: Map<string, Entry>,
  key: string,
  name: string,
  tier: number,
  popularity: number,
): void => {
  const current = byKey.get(key);

  if (current === undefined) {
    byKey.set(key, { name, tier, popularity });
    return;
  }

  const better =
    tier < current.tier || (tier === current.tier && popularity > current.popularity);

  if (better) {
    current.name = name;
    current.tier = tier;
    current.popularity = popularity;
  }
};

const parsePlaces = async (
  path: string,
): Promise<{ byKey: Map<string, Entry>; kept: Map<string, Kept>; stats: Record<string, number> }> => {
  const byKey = new Map<string, Entry>();
  const kept = new Map<string, Kept>();
  const stats = { lines: 0, kept: 0, skippedFeature: 0, skippedShortKey: 0 };

  for await (const line of readLines(path)) {
    stats.lines += 1;
    const col = line.split("\t");
    if (col.length < 15) continue;

    const featureClass = col[6] ?? "";
    const featureCode = col[7] ?? "";
    const tier = TIER[`${featureClass}.${featureCode}`];
    if (tier === undefined) {
      stats.skippedFeature += 1;
      continue;
    }

    const geonameId = col[0] ?? "";
    // Column 2 is `asciiname` - GeoNames' own plain-ASCII form. Column 1 is
    // `name`, which carries macrons ("Rāmpur"). Using column 1 shatters ~40% of
    // the dataset into keys like "r mpur", because the accented letter is not
    // a-z and becomes a space. Read the ASCII column and that never happens.
    const asciiName = (col[2] ?? "").trim();
    const nativeName = (col[1] ?? "").trim();
    const rawName = asciiName !== "" ? asciiName : nativeName;
    if (rawName === "") continue;

    const populationRaw = (col[14] ?? "").trim();
    const popularity = /^\d+$/.test(populationRaw) ? Number(populationRaw) : 0;

    const name = cleanDisplayName(rawName);
    stats.kept += 1;
    if (geonameId !== "") kept.set(geonameId, { name, popularity, tier });

    // Index the cleaned name AND the raw one. "Thalassery Taluk" should be
    // findable by someone who types it in full, and both point at "Thalassery".
    for (const candidate of new Set([name, rawName])) {
      const key = normalizePlaceName(candidate);
      if (key.length < MIN_KEY_LENGTH) {
        stats.skippedShortKey += 1;
        continue;
      }
      offer(byKey, key, name, tier, popularity);
    }
  }

  return { byKey, kept, stats };
};

const parseAlternates = async (
  path: string,
  byKey: Map<string, Entry>,
  kept: Map<string, Kept>,
): Promise<Record<string, number>> => {
  const stats = { lines: 0, added: 0, skippedLang: 0, skippedUnknownPlace: 0, skippedKey: 0 };

  for await (const line of readLines(path)) {
    stats.lines += 1;
    const col = line.split("\t");
    if (col.length < 4) continue;

    const language = (col[2] ?? "").trim().toLowerCase();
    if (!ALT_LANGS.has(language)) {
      stats.skippedLang += 1;
      continue;
    }

    // Only names for rows we actually kept. Otherwise we would import the
    // alternate names of rivers and mountains.
    const place = kept.get((col[1] ?? "").trim());
    if (place === undefined) {
      stats.skippedUnknownPlace += 1;
      continue;
    }

    const alternate = (col[3] ?? "").trim();
    if (alternate === "" || alternate.includes("://")) continue;

    const key = normalizePlaceName(alternate);
    if (key.length < MIN_KEY_LENGTH) {
      stats.skippedKey += 1;
      continue;
    }

    // isHistoric rows are kept deliberately - "Calicut", "Trivandrum",
    // "Cannanore" and "Quilon" are all flagged historic in this file, and they
    // are exactly the names this whole feature exists to resolve.
    offer(byKey, key, place.name, place.tier + ALT_TIER_PENALTY, place.popularity);
    stats.added += 1;
  }

  return stats;
};

/**
 * Hand-written corrections, applied last and ranked above every dataset row.
 *
 * Every entry here was found by running --dry and reading the spot checks, not
 * guessed. Three things the dataset gets wrong, and they are all the same kind
 * of wrong - GeoNames is a geographic index, not an Indian-naming authority:
 *
 *   1. Its canonical name is sometimes the COLONIAL name. "Thalassery" is
 *      stored as an alternate of "Tellicherry"; "Vadakara" as an alternate of
 *      "Badagara". Searching the modern name returned the old one.
 *   2. A renamed city's old name can be outranked by an UNRELATED place with
 *      the same name. "Baroda" resolved to a village of 18,437 people instead
 *      of Vadodara, because that village's own row beats an alias.
 *   3. Population-0 legacy rows win keys they should not: "allahabad" resolved
 *      to a pop-0 "Allahabad" row rather than Prayagraj.
 *
 * Abbreviations are here too because they are in no dataset at all - GeoNames'
 * `abbr` rows are railway and airport codes, not what people type.
 *
 * Keep this list short and evidence-led. Every line should be traceable to a
 * search that came back wrong.
 */
const OVERRIDES: Readonly<Record<string, string>> = {
  // dataset keeps the colonial name as canonical
  thalassery: "Thalassery",
  tellicherry: "Thalassery",
  vadakara: "Vadakara",
  vatakara: "Vadakara",
  badagara: "Vadakara",
  // dataset spelling is not the common one
  kalpetta: "Kalpetta",
  // renamed cities whose old name lost to an unrelated place or a pop-0 row
  allahabad: "Prayagraj",
  baroda: "Vadodara",
  // Both directions, because the dataset's own canonical name is "Panjim" -
  // so without the second line, searching "Panaji" returns "Panjim".
  panjim: "Panaji",
  panaji: "Panaji",
  trichy: "Tiruchirappalli",
  trichinopoly: "Tiruchirappalli",
  // abbreviations, which exist in no dataset
  tvm: "Thiruvananthapuram",
  ekm: "Ernakulam",
  blr: "Bengaluru",
  hyd: "Hyderabad",
};

/** Overrides outrank every dataset tier, which starts at 10. */
const OVERRIDE_TIER = 0;

const applyOverrides = (byKey: Map<string, Entry>): number => {
  let applied = 0;

  for (const [rawKey, correctName] of Object.entries(OVERRIDES)) {
    const key = normalizePlaceName(rawKey);
    if (key.length < MIN_KEY_LENGTH) continue;

    // Borrow the popularity of the place we are pointing at, so an override
    // competes properly in fuzzy ranking instead of arriving with a 0.
    const target = byKey.get(normalizePlaceName(correctName));
    offer(byKey, key, correctName, OVERRIDE_TIER, target?.popularity ?? 0);
    applied += 1;
  }

  return applied;
};

const BATCH_SIZE = 5_000;

const write = async (byKey: Map<string, Entry>): Promise<void> => {
  // This script owns the table, so a full rebuild is the simplest correct
  // behaviour and it is how a changed normalizePlaceName gets rolled out.
  const removed = await prisma.placeName.deleteMany({});
  console.log(`cleared ${removed.count} existing rows`);

  const rows = [...byKey].map(([nameKey, entry]) => ({
    nameKey,
    name: entry.name,
    popularity: entry.popularity,
  }));

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const result = await prisma.placeName.createMany({ data: batch, skipDuplicates: true });
    written += result.count;
    if (i % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`  written ${written} / ${rows.length}`);
    }
  }

  console.log(`done: ${written} rows in place_names`);
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const paths = args.filter((a) => !a.startsWith("--"));
  const placesPath = paths[0];
  const alternatesPath = paths[1];

  if (placesPath === undefined) {
    console.error(
      "usage: npx tsx src/scripts/importPlaces.ts <places IN.txt> [<alternateNames IN.txt>] [--dry]\n" +
        "  places:     https://download.geonames.org/export/dump/IN.zip\n" +
        "  alternates: https://download.geonames.org/export/dump/alternatenames/IN.zip\n" +
        "  (both archives contain a file named IN.txt - extract them to different folders)",
    );
    process.exit(1);
    return;
  }

  console.log(`reading places from ${placesPath}`);
  const { byKey, kept, stats } = await parsePlaces(placesPath);
  console.log(
    `  ${stats.lines} lines, ${stats.kept} kept, ` +
      `${stats.skippedFeature} not a searchable place, ${stats.skippedShortKey} key too short`,
  );
  console.log(`  ${byKey.size} distinct keys so far`);

  if (alternatesPath !== undefined) {
    console.log(`reading alternate names from ${alternatesPath}`);
    const altStats = await parseAlternates(alternatesPath, byKey, kept);
    console.log(
      `  ${altStats.lines} lines, ${altStats.added} usable, ` +
        `${altStats.skippedLang} wrong language/type, ` +
        `${altStats.skippedUnknownPlace} for places we skipped`,
    );
    console.log(`  ${byKey.size} distinct keys total`);
  } else {
    console.log("no alternate names file given - aliases like Calicut will be MISSING");
  }

  const overridden = applyOverrides(byKey);
  console.log(`applied ${overridden} hand-written overrides`);

  // A few spot checks, printed every run. Cheap, and they catch a broken
  // normalizePlaceName before 331k bad rows reach the database.
  console.log("spot checks:");
  for (const probe of [
    "kannur",
    "cannanore",
    "calicut",
    "kozhikode",
    "trivandrum",
    "thiruvananthapuram",
    "kakkanad",
    "kuttuparamba",
    "edappally",
    "west bengal",
    "north goa",
    "south goa",
    "rampur",
  ]) {
    const hit = byKey.get(probe);
    console.log(
      `  ${probe.padEnd(20)} -> ${hit ? `${hit.name} (pop ${hit.popularity})` : "MISSING"}`,
    );
  }

  if (dry) {
    console.log("--dry given, nothing written");
    return;
  }

  await write(byKey);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
