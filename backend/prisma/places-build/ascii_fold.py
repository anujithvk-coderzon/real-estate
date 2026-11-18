import os
"""Make every canonical city name ASCII.

Three names carried diacritics: Mahé (a Puducherry district's only town),
São José de Areal and Penha de França in Goa. The city search is a Postgres
ILIKE with no diacritic folding, so typing "Mahe" matched nothing - and
"Mahe" could not even be added as an alias, because it normalises to the same
key as "Mahé" and the self-alias guard dropped it. Folding the canonical name
is the fix; the accented spelling is cosmetic and nobody types it.
"""
import json, sys, unicodedata, collections
sys.path.insert(0, ".")
from translit import norm

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

def fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

def apply(doc):
    stats = collections.Counter()
    for st, ds in doc["places"].items():
        for d, rows in ds.items():
            for r in rows:
                f = fold(r["city"])
                if f != r["city"]:
                    r["city"] = f
                    stats["city-folded"] += 1
                folded = []
                for a in r["aka"]:
                    fa = fold(a)
                    if norm(fa) != norm(r["city"]):
                        folded.append(fa)
                    else:
                        stats["alias-now-redundant"] += 1
                r["aka"] = sorted(set(folded))
    for st, ds in doc.get("districts", {}).items():
        for e in ds:
            e["name"] = fold(e["name"])
            e["aliases"] = sorted({fold(a) for a in e["aliases"] if norm(fold(a)) != norm(e["name"])})
    return stats

if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    s = apply(doc)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in s.most_common():
        print(f"  {k}: {v}")
