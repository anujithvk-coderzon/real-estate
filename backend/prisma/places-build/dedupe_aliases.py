import os
"""Drop aliases that the normaliser already collapses onto the canonical name.

"NTR" vs "N.T.R.", "Leparada" vs "Lepa Rada", "Keyi Panyor" vs "Keyi-Panyor":
norm() strips punctuation and spaces, so these are the same key and the alias
adds nothing. Keeping them is harmless at lookup time but makes the data look
inconsistent and hides genuine problems in the checks.
"""
import json, sys
sys.path.insert(0, ".")
from translit import norm

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

def tidy(canonical, aliases):
    out, seen = [], {norm(canonical)}
    for a in aliases:
        k = norm(a)
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(a)
    return out

reg = json.load(open("districts.json", encoding="utf-8"))
removed = 0
for st, v in reg.items():
    for d in v["districts"]:
        before = len(d["aliases"])
        d["aliases"] = tidy(d["name"], d["aliases"])
        removed += before - len(d["aliases"])
json.dump(reg, open("districts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"district aliases removed as redundant: {removed}")

doc = json.load(open(DATA_FILE, encoding="utf-8"))
doc["districts"] = {st: [{"name": d["name"], "aliases": d["aliases"]} for d in v["districts"]]
                    for st, v in reg.items()}
rem2 = 0
for st, ds in doc["places"].items():
    for d, rows in ds.items():
        for r in rows:
            before = len(r["aka"])
            r["aka"] = tidy(r["city"], r["aka"])
            rem2 += before - len(r["aka"])
json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
print(f"city aliases removed as redundant: {rem2}")
