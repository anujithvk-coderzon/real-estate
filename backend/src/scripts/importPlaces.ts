
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import process from "node:process";
import { prisma } from "../lib/prisma.js";
import { MIN_KEY_LENGTH, normalizePlaceName } from "../lib/placeNames.js";

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
  "S.RSTN": 60,
};

const ALT_TIER_PENALTY = 5;

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
  return stripped === "" ? raw.trim() : stripped;
};

type Entry = {
  name: string;
  tier: number;
  popularity: number;
};

type Kept = { name: string; popularity: number; tier: number };

const readLines = (path: string) =>
  createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

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
    const asciiName = (col[2] ?? "").trim();
    const nativeName = (col[1] ?? "").trim();
    const rawName = asciiName !== "" ? asciiName : nativeName;
    if (rawName === "") continue;

    const populationRaw = (col[14] ?? "").trim();
    const popularity = /^\d+$/.test(populationRaw) ? Number(populationRaw) : 0;

    const name = cleanDisplayName(rawName);
    stats.kept += 1;
    if (geonameId !== "") kept.set(geonameId, { name, popularity, tier });

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

    offer(byKey, key, place.name, place.tier + ALT_TIER_PENALTY, place.popularity);
    stats.added += 1;
  }

  return stats;
};

const OVERRIDES: Readonly<Record<string, string>> = {
  thalassery: "Thalassery",
  tellicherry: "Thalassery",
  vadakara: "Vadakara",
  vatakara: "Vadakara",
  badagara: "Vadakara",
  kalpetta: "Kalpetta",
  allahabad: "Prayagraj",
  baroda: "Vadodara",
  panjim: "Panaji",
  panaji: "Panaji",
  trichy: "Tiruchirappalli",
  trichinopoly: "Tiruchirappalli",
  tvm: "Thiruvananthapuram",
  ekm: "Ernakulam",
  blr: "Bengaluru",
  hyd: "Hyderabad",
};

const OVERRIDE_TIER = 0;

const applyOverrides = (byKey: Map<string, Entry>): number => {
  let applied = 0;

  for (const [rawKey, correctName] of Object.entries(OVERRIDES)) {
    const key = normalizePlaceName(rawKey);
    if (key.length < MIN_KEY_LENGTH) continue;

    const target = byKey.get(normalizePlaceName(correctName));
    offer(byKey, key, correctName, OVERRIDE_TIER, target?.popularity ?? 0);
    applied += 1;
  }

  return applied;
};

const BATCH_SIZE = 5_000;

const write = async (byKey: Map<string, Entry>): Promise<void> => {
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
