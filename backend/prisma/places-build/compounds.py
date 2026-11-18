import os
"""Make the halves of a compound corporation name searchable.

A municipal corporation often carries a joined name - "Pimpri-Chinchwad",
"Sangli-Miraj-Kupwad", "Vasai-Virar City", "Hubli-Dharwad",
"Mira-Bhayandar". Nobody types the whole thing: they type Pimpri, or Miraj,
or Virar. Only "Kalyan-Dombivli" had its halves attached, and that by hand,
which is why Dombivli worked and the other nine did not.

Each half is added as an alias, unless it already names a different city in
the same district - in which case the half is genuinely ambiguous and is left
alone rather than pointed at the wrong row.
"""
import json, re, sys, collections
sys.path.insert(0, ".")
from translit import norm, plausible_name

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

SPLIT = re.compile(r"\s*[-–/]\s*|\s+and\s+", re.I)
# words that are not a place on their own
NOT_A_PLACE = {"city", "cantonment", "corporation", "municipal", "nagar",
               "township", "ie", "mc", "town", "new", "old", "greater"}


def apply(doc):
    P = doc["places"]
    stats = collections.Counter()
    for st, ds in P.items():
        for d, rows in ds.items():
            official = {norm(r["city"]) for r in rows}
            for r in rows:
                if not SPLIT.search(r["city"]):
                    continue
                parts = [p.strip(" .,-") for p in SPLIT.split(r["city"]) if p.strip(" .,-")]
                if len(parts) < 2:
                    continue
                for p in parts:
                    # strip a trailing descriptor: "Vasai-Virar City" -> Virar
                    p = re.sub(r"\s+\b(city|cantonment|corporation|town)\b$", "", p, flags=re.I).strip()
                    np = norm(p)
                    if (not np or len(p) < 4 or np in NOT_A_PLACE
                            or np == norm(r["city"]) or np in official
                            or not plausible_name(p)):
                        continue
                    if p not in r["aka"]:
                        r["aka"].append(p)
                        stats["halves-added"] += 1
                r["aka"] = sorted(set(r["aka"]))
                if len(r["aka"]) > 8:
                    r["aka"] = sorted(sorted(r["aka"], key=lambda a: (len(a), a))[:8])
    return stats


if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    s = apply(doc)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in s.most_common():
        print(f"  {k}: {v}")
