# India places build

Produces `../data/india-places.json` — 151,565 places across all 36 states and
union territories and all 792 districts, with 2,027 city aliases and about
1,000 district aliases. The 792 match the Local Government Directory's active
district feed one-for-one (its 790, plus Mahe and Yanam kept as separate
regions); stage 11 records 1,679 audited corrections.

You do not need any of this to run the app. `npm run seed:places` loads the
JSON that is already committed. This directory exists so the data can be
**rebuilt and re-verified** rather than trusted.

## Running it

```bash
cd prisma/places-build
./pipeline.sh          # eleven stages, in order
VERIFY_SEED=1 python3 -I verify.py
```

The source downloads are **not** in the repo (they total ~700 MB). Fetch them
into a sibling directory before rebuilding:

| Needed at | From |
|---|---|
| `../post/pincodes.csv` | data.gov.in — All India Pincode Directory |
| `../geonames/IN.txt`, `admin1Codes.txt`, `admin2Codes.txt` | download.geonames.org/export/dump/ |
| `../altnames/IN.txt` | download.geonames.org/export/dump/alternatenames/IN.zip |
| `../census/<State>.html` | citypopulation.de/en/india/`<slug>`/ |

## Why the data looks the way it does

**Districts are researched, not read from the bulk sources.** Neither has a
usable list: India Post's `District` field claims Karnataka has 58 districts
(it has 31), because it mixes postal divisions, old names and typos; GeoNames'
admin2 codes are stale. `districts.json` holds the 792 current districts
verified state by state against government portals and gazette notifications,
with the conflicts recorded in each entry's `disagreement` field. Everything
else is mapped **onto** that list by `resolve.py`, which places 99.9% of India
Post's rows.

**A place is included only if an official source attests it** — the India Post
pincode directory (which supplies its own district) or the Census town
directory. GeoNames is used for aliases only, never for inclusion: nothing
independent can check a GeoNames-only name, because Nominatim is backed by
OSM and shares its errors.

**Aliases never merge two official rows.** An alias is attached only when it
matches exactly one row and does not name another city in the same district.
Over-folding therefore costs a missed alias, never a wrong merge — asserted by
`verify.py`.

## Stage order matters

`pipeline.sh` runs eleven stages and the order is load-bearing. Folding address
fragments creates new rows (`Dwarka` out of `Dwarka Sec 6`), so it must run
**before** the rename and alias passes or those rows never get renamed. This
was a real bug: `Gurgaon` survived as a city beside `Gurugram`.

## Stage 11: recorded corrections

`apply_corrections.py` applies `corrections/*.json` — every correction from the
November 2026 official-source audit, one operation each, with the source it
rests on. It is idempotent (a second run changes nothing) and its renames run
last (`99_official_names.json`); lookups follow them, so an operation can name a
place as it was when the finding was made. It also writes
`../data/place-remap.json`: old address -> current address, used to carry
stored listings across renames.

Policy, applied throughout: the **official name in current use is canonical and
the old name survives as an alias** — Odisha's June 2026 gazette spellings
(Kataka, Baleshwar...), Delhi's 13 gazette districts. Exception by owner
decision: the state stays **Kerala**. The Kerala (Alteration of Name) Act, 2026
is in force, but government sites and every existing address still say Kerala;
"Keralam" resolves as an alias.

## Updating a database that already has places

`npm run seed:places` only inserts, so it cannot remove merged or renamed rows.
Use the rewrite instead — one transaction, verified before commit:

```bash
npm run rewrite:places -- --dry-run            # report only
npm run rewrite:places -- --remap-addresses    # rewrite + update listings/projects
```

## Known limitations

- **9 districts hold no places** (down from 74): new Arunachal districts, Kamjong,
  Niuland and Noklak, whose towns have no post office or census status yet.
  They are still selectable - the District field lists from the registry, not
  from the places table.
- **Not every settlement in India is here.** India Post has 155,599 post
  offices; India has roughly 640,000 villages. Every state, every district and
  every official town is present. A hamlet with no post office and no census
  town status appears in no free dataset.
- Some corrections rest on a single source: several state portals were
  unreachable during verification and the Local Government Directory is
  CAPTCHA-gated.

## Files

| | |
|---|---|
| `pipeline.sh` | runs the ten stages in order |
| `states.py` | the 36 canonical states and their alternate spellings |
| `districts.json` | the 792 verified districts, with sources and conflicts |
| `translit.py` | when two spellings are the same place, and when they are not |
| `resolve.py` | maps a source's district label onto a canonical district |
| `corrections.py` | source labels no string rule can reach |
| `census_parse.py` | Census town directory → towns with a tier |
| `build.py` | India Post + Census → the place rows |
| `aliases.py`, `finalize.py` | GeoNames English/historic alternate names |
| `fragments.py` | `Dwarka Sec 6` → `Dwarka`, with the fragment as an alias |
| `citynames.py` | city renames (`Bombay`→`Mumbai`), pinned per district |
| `compounds.py` | `Pimpri-Chinchwad` → both halves searchable |
| `audit_fixes.py`, `audit2_fixes.py`, `audit3_fixes.py` | corrections from the regional audits, one entry per finding with its reason |
| `ascii_fold.py` | strips diacritics, because the city search is a plain ILIKE |
| `verify.py` | 20 checks; `t13` samples randomly so repeated runs cover new data |

`districtAliases.ts` is generated here and copied to
`../../src/modules/places/`. Do not edit that copy by hand.

## Verification

`verify.py` runs 20 checks. Nineteen are deterministic — state and district
completeness, no duplicate city within a district, no alias naming another
city, valid tiers, every row officially sourced, known cities present, every
historical name resolving, and the specific faults the audits found, kept as
tests so they cannot regress. The twentieth samples 2,000 places at random
against `VERIFY_SEED`, so ten runs with ten seeds cover ten different parts of
a 151k-row dataset instead of repeating one pass.

Nine independent regional auditors checked all 36 states against government
sources. What they found is recorded in the `audit*_fixes.py` comments,
including the cases where an auditor retracted a finding and the correction
had to be reverted.
