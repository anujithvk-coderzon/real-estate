import os
"""Apply the regional audits' corrections to the built dataset."""
import json, sys, collections
sys.path.insert(0, ".")
from translit import norm, canon, plausible_name
from audit_fixes import RELOCATE, RESPELL, UNALIAS, ADD_ALIAS

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

def apply(doc):
    P = doc["places"]
    stats = collections.Counter()

    # --- RELOCATE: move a town to the district it actually belongs to ------
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
                # only move a TOWN; a same-named locality elsewhere stays put
                if r["tier"] == "locality":
                    continue
                existing = next((x for x in ds[target] if norm(x["city"]) == norm(city)), None)
                if existing:
                    existing["aka"] = sorted(set(existing["aka"]) | set(r["aka"]))
                    existing["src"] = sorted(set(existing["src"]) | set(r["src"]))
                    if existing["tier"] == "locality":
                        existing["tier"] = r["tier"]
                    stats["relocate-merged"] += 1
                else:
                    ds[target].append(r)
                    stats["relocated"] += 1
                rows.remove(r)

    # --- RESPELL: the name people write becomes canonical -----------------
    for (st, old), new in RESPELL.items():
        if norm(old) == norm(new):
            continue
        for d, rows in P.get(st, {}).items():
            official = {norm(r["city"]) for r in rows}
            for r in list(rows):
                if norm(r["city"]) != norm(old):
                    continue
                twin = next((x for x in rows
                             if x is not r and (norm(x["city"]) == norm(new)
                                                or canon(x["city"]) == canon(new))), None)
                if twin and twin is not r:
                    # The twin may itself be stored under a third spelling
                    # ("Dharamsala" beside "Dharmsala"); the whole point of the
                    # correction is that `new` becomes canonical, so set it
                    # rather than inheriting whichever spelling got there first.
                    twin["aka"] = sorted(
                        set(twin["aka"]) | {r["city"]} | set(r["aka"])
                        | ({twin["city"]} if norm(twin["city"]) != norm(new) else set()))
                    twin["city"] = new
                    twin["src"] = sorted(set(twin["src"]) | set(r["src"]))
                    if twin["tier"] == "locality":
                        twin["tier"] = r["tier"]
                    rows.remove(r)
                    stats["respell-merged"] += 1
                else:
                    r["aka"] = sorted(set(r["aka"]) | {r["city"]})
                    r["city"] = new
                    stats["respelled"] += 1

    # --- UNALIAS: an alias naming a different place -----------------------
    for (st, only_d, city), bad in UNALIAS.items():
        drop = {norm(b) for b in bad}
        for d, rows in P.get(st, {}).items():
            if only_d and d != only_d:
                continue
            for r in rows:
                if norm(r["city"]) != norm(city):
                    continue
                before = len(r["aka"])
                r["aka"] = [a for a in r["aka"] if norm(a) not in drop]
                stats["aliases-removed"] += before - len(r["aka"])

    # --- ADD_ALIAS --------------------------------------------------------
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
                    if not na or na == norm(r["city"]) or not plausible_name(a):
                        continue
                    if na in official:          # it is another city here
                        stats["alias-blocked"] += 1
                        continue
                    if a not in r["aka"]:
                        r["aka"].append(a)
                        stats["aliases-added"] += 1
                r["aka"] = sorted(set(r["aka"]))

    # --- pinned historical aliases ---------------------------------------
    # A historical name belongs to ONE place. "Mangalore" reached three rows:
    # the real Mangaluru plus same-named villages in Koppal and Kalaburagi,
    # because two different code paths attach aliases and only one honoured
    # the pin. Enforce it here, where every path has already run.
    from citynames import RENAME_DISTRICT
    for (st, old), want_d in RENAME_DISTRICT.items():
        n_old = norm(old)
        for d, rows in P.get(st, {}).items():
            if d == want_d:
                continue
            for r in rows:
                if any(norm(x) == n_old for x in r["aka"]):
                    r["aka"] = [x for x in r["aka"] if norm(x) != n_old]
                    stats["pinned-alias-stripped"] += 1

    # keep every district sorted, and re-assert the alias invariant
    for st, ds in P.items():
        for d, rows in ds.items():
            for r in rows:
                seen = {norm(r["city"])}
                clean = []
                for a in r["aka"]:
                    k = norm(a)
                    if k and k not in seen and plausible_name(a):
                        seen.add(k); clean.append(a)
                r["aka"] = clean
            rows.sort(key=lambda x: x["city"])
    return stats

if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    st = apply(doc)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in st.most_common():
        print(f"  {k}: {v}")
    n = sum(len(r) for v in doc["places"].values() for r in v.values())
    a = sum(len(x["aka"]) for v in doc["places"].values() for r in v.values() for x in r)
    print(f"\nplaces {n}  aliases {a}")
