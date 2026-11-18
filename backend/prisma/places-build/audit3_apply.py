import os
import json, sys, collections
sys.path.insert(0, ".")
from translit import norm, canon, plausible_name
from audit3_fixes import RELOCATE, RESPELL, ADD_ALIAS, UNALIAS, TIER, DISTRICT_RENAME
import audit2_apply

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

def apply(doc, reg):
    P = doc["places"]
    st_counts = collections.Counter()
    # reuse round two's machinery by swapping its tables for round three's
    audit2_apply.RELOCATE = RELOCATE
    audit2_apply.RESPELL = RESPELL
    audit2_apply.ADD_ALIAS = ADD_ALIAS
    audit2_apply.DISTRICT_ALIAS = {}
    st_counts.update(audit2_apply.apply(doc, reg))

    for (s, only_d, city), bad in UNALIAS.items():
        drop = {norm(b) for b in bad}
        for d, rows in P.get(s, {}).items():
            if only_d and d != only_d:
                continue
            for r in rows:
                if norm(r["city"]) != norm(city):
                    continue
                before = len(r["aka"])
                r["aka"] = [a for a in r["aka"] if norm(a) not in drop]
                st_counts["aliases-removed"] += before - len(r["aka"])

    for (s, city), tier in TIER.items():
        for d, rows in P.get(s, {}).items():
            for r in rows:
                if norm(r["city"]) == norm(city) and r["tier"] != tier:
                    r["tier"] = tier
                    st_counts["tier-set"] += 1

    for (s, old), new in DISTRICT_RENAME.items():
        entry = reg.get(s)
        if not entry:
            continue
        for d in entry["districts"]:
            if d["name"] != old:
                continue
            d["aliases"] = sorted({a for a in d["aliases"] + [old]
                                   if norm(a) != norm(new)})
            d["name"] = new
            st_counts["district-renamed"] += 1
            break
        if s in P and old in P[s]:
            P[s].setdefault(new, [])
            P[s][new].extend(P[s].pop(old))
            st_counts["district-places-moved"] += 1
    return st_counts

if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    reg = json.load(open("districts.json", encoding="utf-8"))
    s = apply(doc, reg)
    doc["districts"] = {k: [{"name": d["name"], "aliases": d["aliases"]} for d in v["districts"]]
                        for k, v in reg.items()}
    json.dump(reg, open("districts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in s.most_common():
        print(f"  {k}: {v}")
