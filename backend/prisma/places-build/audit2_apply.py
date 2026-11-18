import os
"""Apply the round-two corrections, and add the missing district aliases."""
import json, sys, collections
sys.path.insert(0, ".")
from translit import norm, canon, plausible_name
from audit2_fixes import RELOCATE, RESPELL, ADD_ALIAS, DISTRICT_ALIAS

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

def apply(doc, reg):
    P = doc["places"]
    stats = collections.Counter()

    for (st, city), target in RELOCATE.items():
        ds = P.get(st)
        if ds is None or target not in ds:
            stats["relocate-no-target"] += 1
            continue
        for d, rows in ds.items():
            if d == target:
                continue
            for r in list(rows):
                if norm(r["city"]) != norm(city):
                    continue
                twin = next((x for x in ds[target] if canon(x["city"]) == canon(r["city"])), None)
                if twin:
                    twin["aka"] = sorted(set(twin["aka"]) | set(r["aka"]))
                    twin["src"] = sorted(set(twin["src"]) | set(r["src"]))
                    if twin["tier"] == "locality" and r["tier"] != "locality":
                        twin["tier"] = r["tier"]
                    stats["relocate-merged"] += 1
                else:
                    ds[target].append(r)
                    stats["relocated"] += 1
                rows.remove(r)

    for (st, old), new in RESPELL.items():
        for d, rows in P.get(st, {}).items():
            for r in list(rows):
                if norm(r["city"]) != norm(old):
                    continue
                twin = next((x for x in rows if x is not r and canon(x["city"]) == canon(new)), None)
                if twin:
                    twin["aka"] = sorted(set(twin["aka"]) | {r["city"]} | set(r["aka"])
                                         | ({twin["city"]} if norm(twin["city"]) != norm(new) else set()))
                    twin["city"] = new
                    twin["src"] = sorted(set(twin["src"]) | set(r["src"]))
                    if twin["tier"] == "locality" and r["tier"] != "locality":
                        twin["tier"] = r["tier"]
                    rows.remove(r)
                    stats["respell-merged"] += 1
                else:
                    r["aka"] = sorted(set(r["aka"]) | {r["city"]})
                    r["city"] = new
                    stats["respelled"] += 1

    for (st, only_d, city), extra in ADD_ALIAS.items():
        for d, rows in P.get(st, {}).items():
            if only_d and d != only_d:
                continue
            official = {norm(r["city"]) for r in rows}
            for r in rows:
                if norm(r["city"]) != norm(city):
                    continue
                for a in extra:
                    na = norm(a)
                    if not na or na == norm(r["city"]) or na in official or not plausible_name(a):
                        stats["alias-blocked"] += 1 if na in official else 0
                        continue
                    if a not in r["aka"]:
                        r["aka"].append(a)
                        stats["aliases-added"] += 1
                r["aka"] = sorted(set(r["aka"]))

    # district aliases: the HQ town is the only name most people know for a
    # recently created district, and 24 of Arunachal's 27 had none at all
    for st, m in DISTRICT_ALIAS.items():
        entry = reg.get(st)
        if not entry:
            continue
        official = {norm(x["name"]) for x in entry["districts"]}
        for dn, extra in m.items():
            for d in entry["districts"]:
                if d["name"] != dn:
                    continue
                have = {norm(a) for a in d["aliases"]}
                for a in extra:
                    na = norm(a)
                    if na and na != norm(dn) and na not in have and na not in official:
                        d["aliases"].append(a)
                        have.add(na)
                        stats["district-aliases-added"] += 1
                break

    # re-assert the invariants after all of that
    for st, ds in P.items():
        for d, rows in ds.items():
            seen = {}
            for r in rows:
                k = canon(r["city"]) or norm(r["city"])
                if k in seen:
                    keep = seen[k]
                    keep["aka"] = sorted(set(keep["aka"]) | {r["city"]} | set(r["aka"]))
                    keep["src"] = sorted(set(keep["src"]) | set(r["src"]))
                    if keep["tier"] == "locality" and r["tier"] != "locality":
                        keep["tier"] = r["tier"]
                    stats["final-merged"] += 1
                else:
                    seen[k] = r
            rows[:] = sorted(seen.values(), key=lambda x: x["city"])
            names = {norm(r["city"]) for r in rows}
            for r in rows:
                # Dedupe by NORMALISED form, not by string: "Nalasopara" and
                # "Nala Sopara" are one alias, and two passes can each add
                # their own spelling.
                keep, seen = [], {norm(r["city"])}
                for a in sorted(r["aka"], key=lambda x: (len(x), x)):
                    k = norm(a)
                    if not k or k in seen or k in names or not plausible_name(a):
                        continue
                    seen.add(k)
                    keep.append(a)
                r["aka"] = sorted(keep)
                if len(r["aka"]) > 8:
                    r["aka"] = sorted(sorted(r["aka"], key=lambda a: (len(a), a))[:8])
    return stats

if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    reg = json.load(open("districts.json", encoding="utf-8"))
    s = apply(doc, reg)
    doc["districts"] = {st: [{"name": d["name"], "aliases": d["aliases"]} for d in v["districts"]]
                        for st, v in reg.items()}
    json.dump(reg, open("districts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in s.most_common():
        print(f"  {k}: {v}")
