"""Build the all-India place dataset.

Inclusion follows the standard settled on for Kerala: a row is kept only if an
OFFICIAL source attests it — the India Post pincode directory (which supplies
its own district) or the Census town directory. GeoNames is used for ALIASES
only, never for inclusion, because nothing independent can check a
GeoNames-only name: Nominatim is backed by OSM, which shares GeoNames' errors.
"""
import csv, collections, json, re, sys
sys.path.insert(0, ".")
from resolve import resolve
from translit import canon, norm, plausible_name, match_rule, QUALIFIER, tidy_case

# India Post writes an office name, not a place name. Three decorations have
# to come off, and two things that LOOK like decorations must be left alone:
#   "Agali S.O (Ananthapur)"  -> Agali          (postal class + disambiguator)
#   "Atmakur(ATP)"            -> Atmakur        (disambiguator alone)
#   "Egmore Ndso"             -> Egmore         (postal class spelled out)
#   "A Narayanapuram"         -> unchanged      (a real Andhra village prefix)
#   "Taralangso No 1"         -> unchanged      (a real Assam village name)
# Getting the second group wrong would delete thousands of genuine places, so
# only an explicit postal vocabulary is stripped.
POSTAL_CLASS = r"(?:[BSH]\.?\s?O|G\.?P\.?O|E\.?D\.?S\.?O|N\.?D\.?S\.?O|NDSO|S\.?O|B\.?O|H\.?O|T\.?C)"
# the class plus an optional "(District)" tail, at the end of the string
SUFFIX = re.compile(rf"[\s,.-]*\b{POSTAL_CLASS}\b\.?\s*(?:\([^)]*\))?\s*$", re.I)
# a bare "(Something)" tail: the row already knows its district
PAREN = re.compile(r"\s*\([^)]*\)\s*$")
# the class followed by a bare district name instead of a parenthetical, and a
# trailing apostrophe India Post sometimes leaves behind:
#   "APColony SO Gaya" -> APColony      "Tadur Bo'" -> Tadur
TAIL = re.compile(rf"\s+\b{POSTAL_CLASS}\b['\u2019.]?(?:\s+\S+){{0,4}}\s*$", re.I)
# the class in the middle, as in "Pallapatti S.O (Karur) Extension"
MIDDLE = re.compile(rf"\s+\b{POSTAL_CLASS}\b\.?\s+(?=\()", re.I)


def office_name(raw: str) -> str:
    n = " ".join((raw or "").split())
    for _ in range(3):                      # suffix then disambiguator, repeatedly
        before = n
        n = MIDDLE.sub(" ", n)
        n = SUFFIX.sub("", n)
        n = TAIL.sub("", n)
        n = PAREN.sub("", n)
        n = n.strip(" .,-")
        if n == before:
            break
    return tidy_case(n)

places = collections.defaultdict(dict)   # (state,district) -> key -> record
stats = collections.Counter()

# ---- 1. India Post: the address-level layer -------------------------------
for r in csv.DictReader(open("../post/pincodes.csv", encoding="utf-8", errors="replace")):
    st = r.get("StateName") or ""
    if not st.strip():
        continue
    state, district, _ = resolve(st, r.get("District") or "")
    if not district:
        stats["no-district"] += 1
        continue
    name = office_name(r.get("Office Name") or "")
    if not plausible_name(name):
        stats["name-rejected"] += 1
        continue
    key = canon(name) or norm(name)
    rec = places[(state, district)].get(key)
    if rec is None:
        places[(state, district)][key] = {
            "city": name, "tier": "locality", "src": {"indiapost"}, "aka": set()}
        stats["post-new"] += 1
    else:
        if norm(name) != norm(rec["city"]):
            rec["aka"].add(name)          # a second spelling of the same place
            stats["post-spelling"] += 1
        rec["src"].add("indiapost")

# ---- 2. Census towns: the tier that makes a place a town ------------------
for k, towns in json.load(open("census_towns.json", encoding="utf-8")).items():
    state, district = k.split("|", 1)
    for t in towns:
        key = canon(t["name"]) or norm(t["name"])
        rec = places[(state, district)].get(key)
        if rec is None:
            # canon() cannot bridge a vowel from a different class, so the
            # census "Kondapalle" sat beside India Post "Kondapalli" as two
            # rows with the tier on only one. Fall back to the full match
            # rule, and only when exactly ONE existing row matches.
            hits = [r for r in places[(state, district)].values()
                    if match_rule(r["city"], t["name"])]
            if len(hits) == 1:
                rec = hits[0]
                stats["census-fuzzy-merged"] += 1
        if rec is None:
            places[(state, district)][key] = {
                "city": t["name"], "tier": t["tier"], "src": {"census"}, "aka": set()}
            stats["census-new"] += 1
        else:
            rec["tier"] = t["tier"]        # census tier beats "locality"
            rec["src"].add("census")
            if norm(t["name"]) != norm(rec["city"]):
                rec["aka"].add(t["name"])
            # the census spelling is the better canonical one for a town
            if t["tier"] != "locality":
                if norm(rec["city"]) != norm(t["name"]):
                    rec["aka"].add(rec["city"])
                rec["city"] = t["name"]
            stats["census-merged"] += 1

print("after official sources:")
for k, v in stats.most_common(): print(f"  {k}: {v}")
print(f"  (state,district) pairs: {len(places)}")
print(f"  places: {sum(len(v) for v in places.values())}")
json.dump({f"{s}|{d}": [{**r, "src": sorted(r["src"]), "aka": sorted(r["aka"])}
                        for r in v.values()]
           for (s, d), v in places.items()},
          open("places_stage1.json", "w", encoding="utf-8"), ensure_ascii=False)
