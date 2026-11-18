import { prisma } from "../../lib/prisma.js";
import { districtAliasesFor, districtsOf } from "./districtAliases.js";
import { stateAliasesFor } from "./stateAliases.js";

/**
 * Type-ahead over places, one level at a time: states, then the districts of a
 * state, then the cities of one district.
 *
 * Alternate romanisations live in `places.aka`, so a seller who types the
 * spelling they grew up with still finds the row — "Tellicherry" for
 * Thalassery, "Trivandrum" for Thiruvananthapuram, "Cuttack" for Kataka.
 *
 * Every comparison ignores case, spacing, punctuation and diacritics. People
 * write "Yamuna Nagar" and "Yamunanagar", "Imphal-East" and "Imphal East",
 * "Ali Pur" and "Alipur" interchangeably; storing each spacing as an alias
 * would never be complete, so the comparison folds them instead.
 */

export type PlaceHit = { name: string; alias?: string };

/** "Imphal-East" -> "imphaleast", "Chümoukedima" -> "chumoukedima". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// A user's text is data, never pattern syntax: escape the wildcards before
// they reach ILIKE, or a typed "%" would match every row.
const literal = (q: string) => q.replace(/[%_\\]/g, (c) => `\\${c}`);

/**
 * Rank names against what was typed: exact, then prefix, then an alias
 * prefix, then contains, then an alias that contains it. Shared by the state
 * and district levels, which are small enough to rank in memory.
 */
const rank = (
  names: readonly string[],
  aliasesOf: (name: string) => readonly string[],
  q: string,
  take: number,
): PlaceHit[] => {
  const needle = fold(q);
  if (!needle) return names.slice(0, take).map((name) => ({ name }));

  const scored: { hit: PlaceHit; rank: number }[] = [];
  for (const name of names) {
    const own = fold(name);
    const aliases = aliasesOf(name);
    const aliasWith = (test: (a: string) => boolean) =>
      aliases.find((a) => test(fold(a)));
    let alias: string | undefined;
    if (own === needle) scored.push({ hit: { name }, rank: 0 });
    else if ((alias = aliasWith((a) => a === needle)))
      scored.push({ hit: { name, alias }, rank: 1 });
    else if (own.startsWith(needle)) scored.push({ hit: { name }, rank: 2 });
    else if ((alias = aliasWith((a) => a.startsWith(needle))))
      scored.push({ hit: { name, alias }, rank: 3 });
    else if (own.includes(needle)) scored.push({ hit: { name }, rank: 4 });
    else if ((alias = aliasWith((a) => a.includes(needle))))
      scored.push({ hit: { name, alias }, rank: 5 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.hit.name.localeCompare(b.hit.name))
    .slice(0, take)
    .map((s) => s.hit);
};

export const statesService = async (q: string, take: number) => {
  // Few enough rows to rank in JS, which is what lets a historical name be
  // matched at all: "Orissa" and "Pondicherry" are not in the table.
  const rows = await prisma.place.groupBy({
    by: ["state"],
    orderBy: { state: "asc" },
  });
  return rank(rows.map((r) => r.state), stateAliasesFor, q, take);
};

export const districtsService = async (
  state: string,
  q: string,
  take: number,
) => {
  // The list comes from the verified registry, not from the places table: a
  // district created after India Post compiled its data holds no rows yet,
  // and listing from the table made it impossible to pick.
  const canonical = (await prisma.place.findFirst({
    where: { state: { equals: state, mode: "insensitive" } },
    select: { state: true },
  }))?.state;
  if (!canonical) return [];
  return rank(
    districtsOf(canonical),
    (district) => districtAliasesFor(canonical, district),
    q,
    take,
  );
};

type Row = { name: string; alias: string | null };
const shape = (rows: Row[]): PlaceHit[] =>
  rows.map((r) => (r.alias ? { name: r.name, alias: r.alias } : { name: r.name }));

export const citiesService = async (
  state: string,
  district: string,
  q: string,
  take: number,
) => {
  const n = literal(q);
  // Folded form: letters and digits only, so it can never carry a wildcard.
  const f = fold(q);
  const blank = q.trim() === "";
  const folded = f !== "";
  const rows = await prisma.$queryRaw<Row[]>`
    WITH c AS (
      SELECT city, aka,
             regexp_replace(lower(city), '[^a-z0-9]', '', 'g') AS fc
        FROM places
       WHERE state ILIKE ${state}
         AND district ILIKE ${district}
    )
    SELECT city AS name,
           CASE WHEN city ILIKE ${"%" + n + "%"}
                  OR (${folded} AND fc LIKE ${"%" + f + "%"}) THEN NULL
                ELSE (SELECT a FROM unnest(aka) a
                       WHERE a ILIKE ${"%" + n + "%"}
                          OR (${folded} AND regexp_replace(lower(a), '[^a-z0-9]', '', 'g') LIKE ${"%" + f + "%"})
                       LIMIT 1)
           END AS alias
      FROM c
     WHERE ${blank}
        OR city ILIKE ${"%" + n + "%"}
        OR (${folded} AND fc LIKE ${"%" + f + "%"})
        OR EXISTS (SELECT 1 FROM unnest(aka) a
                    WHERE a ILIKE ${"%" + n + "%"}
                       OR (${folded} AND regexp_replace(lower(a), '[^a-z0-9]', '', 'g') LIKE ${"%" + f + "%"}))
     ORDER BY
       -- an exact hit first, including on an alias, so "calicut" offers
       -- Kozhikode before Calicut Beach; then what the typing starts,
       -- then anything merely containing it
       CASE WHEN fc = ${f} THEN 0
            WHEN EXISTS (SELECT 1 FROM unnest(aka) a
                          WHERE regexp_replace(lower(a), '[^a-z0-9]', '', 'g') = ${f}) THEN 1
            WHEN ${folded} AND fc LIKE ${f + "%"} THEN 2
            WHEN ${folded} AND EXISTS (SELECT 1 FROM unnest(aka) a
                          WHERE regexp_replace(lower(a), '[^a-z0-9]', '', 'g') LIKE ${f + "%"}) THEN 3
            ELSE 4 END,
       -- length only breaks ties between actual matches; with an empty box
       -- the list is just alphabetical, which reads as a browsable index
       CASE WHEN ${blank} THEN 0 ELSE length(city) END,
       city
     LIMIT ${take}
  `;
  return shape(rows);
};
