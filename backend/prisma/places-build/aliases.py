"""Attach alternate spellings to the official rows.

Two feeds:
  1. GeoNames alternate names filtered to English and historic entries. This
     is where Bombay, Madras, Calcutta, Vizag, Benares, Trichinopoly and
     Cawnpore live. The raw column also holds airport codes, foreign-language
     transliterations and outright errors, so the language/flag columns do the
     filtering.
  2. Spellings already collected from the official sources themselves.

Safety rule, carried over from Kerala and asserted in verify.py: an alias may
NEVER equal another official city in the same district, and is attached only
when it matches exactly ONE row. Over-folding therefore costs a missed alias,
never a wrong merge.
"""
import csv, collections, json, sys
sys.path.insert(0, ".")
from resolve import resolve
from translit import canon, norm, plausible_name, match_rule

EXCLUDE_LANG = {"link", "wkdt", "abbr", "unlc", "iata", "icao", "faac", "post", "phon", "nrm"}

def load_geonames_aliases():
    """geonameid -> (state, district, canonical name, [candidate aliases])"""
    a1, a2 = {}, {}
    for line in open("../geonames/admin1Codes.txt", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0].startswith("IN."):
            a1[p[0].split(".")[1]] = p[1]
    for line in open("../geonames/admin2Codes.txt", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0].startswith("IN."):
            b = p[0].split(".")
            if len(b) >= 3:
                a2[(b[1], b[2])] = p[1]

    base = {}
    for r in csv.reader(open("../geonames/IN.txt", encoding="utf-8", newline=""),
                        delimiter="\t", quoting=csv.QUOTE_NONE):
        if len(r) < 15 or r[8] != "IN" or r[6] != "P":
            continue
        state, district, _ = resolve(a1.get(r[10], ""), a2.get((r[10], r[11]), ""))
        if district:
            base[r[0]] = (state, district, r[2])

    alts = collections.defaultdict(set)
    for r in csv.reader(open("../altnames/IN.txt", encoding="utf-8", newline=""),
                        delimiter="\t", quoting=csv.QUOTE_NONE):
        if len(r) < 4:
            continue
        gid, lang, name = r[1], r[2].strip().lower(), r[3]
        historic = len(r) > 7 and r[7] == "1"
        if gid not in base or lang in EXCLUDE_LANG:
            continue
        # English, or a historic name in English/unspecified. A historic name
        # tagged with a foreign language is Bombėjus or Kalkutta, not Bombay.
        if lang == "en" or (historic and lang in ("", "en")):
            if plausible_name(name):
                alts[gid].add(name.strip())
    return base, alts
