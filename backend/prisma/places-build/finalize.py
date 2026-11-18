import os
import json, sys, collections
sys.path.insert(0, ".")
from aliases import load_geonames_aliases
from translit import norm, canon, match_rule

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

stage1 = json.load(open("places_stage1.json", encoding="utf-8"))
places = {}
for k, rows in stage1.items():
    st, d = k.split("|", 1)
    places[(st, d)] = {canon(r["city"]) or norm(r["city"]): {
        "city": r["city"], "tier": r["tier"], "src": set(r["src"]), "aka": set(r["aka"])}
        for r in rows}

base, alts = load_geonames_aliases()
stats = collections.Counter()
for gid, cands in alts.items():
    st, d, gname = base[gid]
    bucket = places.get((st, d))
    if not bucket:
        stats["no-such-district"] += 1
        continue
    official = {norm(r["city"]) for r in bucket.values()}
    # find the one official row this GeoNames place corresponds to
    hits = [r for r in bucket.values() if match_rule(r["city"], gname)]
    if len(hits) != 1:
        stats["ambiguous-or-absent" if hits else "geonames-only-place"] += 1
        continue
    rec = hits[0]
    for a in cands:
        na = norm(a)
        if not na or na == norm(rec["city"]):
            continue
        if na in official:
            stats["blocked-collides-with-city"] += 1   # the safety rule
            continue
        rec["aka"].add(a)
        rec["src"].add("geonames-alt")
        stats["alias-added"] += 1

for k, v in stats.most_common(): print(f"  {k}: {v}")

out = {}
for (st, d), bucket in places.items():
    out.setdefault(st, {})[d] = sorted(
        ({"city": r["city"], "tier": r["tier"],
          "aka": sorted(a for a in r["aka"] if norm(a) != norm(r["city"])),
          "src": sorted(r["src"])} for r in bucket.values()),
        key=lambda x: x["city"])

reg = json.load(open("districts.json", encoding="utf-8"))
for st, v in reg.items():
    out.setdefault(st, {})
    for d in v["districts"]:
        out[st].setdefault(d["name"], [])

doc = {
 "country": "India",
 "description": "Places of India by state and district. Every row is attested by an official government source: the India Post pincode directory or the Census town directory. `aka` holds alternate and historical spellings.",
 "sources": ["India Post All-India Pincode Directory (data.gov.in)",
             "Census of India town directory (via citypopulation.de)",
             "GeoNames alternate names (English and historic entries only)",
             "District lists verified per state against government portals and gazette notifications"],
 "districts": {st: [{"name": d["name"], "aliases": d["aliases"]} for d in v["districts"]]
               for st, v in reg.items()},
 "places": out,
}
json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
nplaces = sum(len(c) for v in out.values() for c in v.values())
naka = sum(len(r["aka"]) for v in out.values() for c in v.values() for r in c)
print(f"\nstates {len(out)}  districts {sum(len(v) for v in out.values())}  places {nplaces}  aliases {naka}")
