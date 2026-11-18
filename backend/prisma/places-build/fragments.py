import os
"""Recover the parent locality from India Post's address fragments.

India Post names an OFFICE, so a large locality appears only as its pieces:
"Dwarka Sec 6", "Rohini sec11", "Okhla Industrial Area Phasei",
"Mayur Vihar PhI". The locality itself - which is what a seller picks in a
dropdown - never appears. Dwarka and Rohini are each over 700,000 people.

For every fragment, derive the parent, add it as a real row if missing, and
keep the fragment as an ALIAS of the parent rather than a separate row. The
dropdown then offers "Dwarka" once, and someone typing "Dwarka Sector 6"
still lands on it.

Facilities are dropped outright: an air-force station or a bank counter is not
a place a property sits in.
"""
import json, re, sys, collections
sys.path.insert(0, ".")
from translit import norm, canon, plausible_name

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

# Only urban-planning subdivisions are treated as fragments. "Sector", "Phase",
# "Pocket" and "Block" name a piece of a planned locality, so the parent is
# certainly a real place. A bare "No 1" or "Pt 2" is NOT safe: "Taralangso
# No 1" and "Chak 1 KK" are whole village names in Assam and Rajasthan, and
# folding them would invent a parent that does not exist.
PLANNED = re.compile(
    r"\s*[-,]?\s*\b(sec|sect|sector|ph|phase|pkt|pocket|blk|block)\b"
    r"\.?\s*(?:[ivx]+|\d+)?\s*$", re.I)
# the same, glued: "Phasei", "Seci", "Sec11"
PLANNED_GLUED = re.compile(r"\s*\b(?:sec|sect|sector|ph|phase|pkt|blk|block)(?:[ivx]+|\d+)\s*$", re.I)
# "Vasant Vihar1" - a digit glued to the last word
GLUED = re.compile(r"(?<=[A-Za-z])\d+\s*$")
# a roman-numeral tail: "Model Town II", "Mayur Vihar PhI"
ROMAN_TAIL = re.compile(r"\s+\b(?:ph)?\s*(?:i{1,3}|iv|v|vi{1,3}|ix|x)\b\.?\s*$", re.I)
# an administrative word that is not part of the name. Applied ONCE and only
# first: applying it after a numeral strip turned "Model Town II" into "Model".
ADMIN_TAIL = re.compile(r"\s+\b(town|village|po|p\.o)\b\.?\s*$", re.I)

# two or more single-letter tokens at the start, or a facility word: these are
# installations, not settlements
FACILITY = re.compile(
    r"^(?:[A-Za-z]\s+){2,}"                       # "A F Palam", "F F C Okhla"
    r"|^(?:i\.?t|a\.?f|a\.?c|r\.?s|c\.?o\.?d)\s"  # IT / Air Force / AC / RS / COD
    r"|\b(extension counter|factory|depot|workshop|godown|press|"
    r"telephone nigam|postal sb|sub depot)\b", re.I)


def planned_parent(name: str) -> str:
    """The parent of a PLANNED subdivision - "Dwarka Sec 6" -> "Dwarka".
    Returns "" when the name is not such a fragment. These are safe to create,
    because "Sector"/"Phase"/"Block" only exist as part of a larger locality."""
    if not (PLANNED.search(name) or PLANNED_GLUED.search(name)):
        return ""
    n = name
    for _ in range(3):
        before = n
        n = PLANNED_GLUED.sub("", n)
        n = PLANNED.sub("", n)
        n = n.strip(" .,-")
        if n == before:
            break
    n = ROMAN_TAIL.sub("", n).strip(" .,-")
    n = GLUED.sub("", n).strip(" .,-")
    return n if norm(n) != norm(name) else ""


def conditional_parent(name: str) -> str:
    """A base that may only be used if it ALREADY EXISTS in the district.

    Covers an administrative suffix ("Adoni town") and a digit glued to the
    last word ("Vasant Vihar1"). Never a spaced numeral: "Lore I" and "Lore II"
    are two villages, and "Model Town" is a locality whose name ends in Town -
    stripping either would merge or invent a place. Requiring the base to
    exist already is what keeps that honest.
    """
    n = ADMIN_TAIL.sub("", name).strip(" .,-")
    n = GLUED.sub("", n).strip(" .,-")
    return n if norm(n) != norm(name) and len(n) >= 3 else ""


def apply(doc):
    P = doc["places"]
    stats = collections.Counter()
    for st, ds in P.items():
        for d, rows in ds.items():
            by = {norm(r["city"]): r for r in rows}
            for r in list(rows):
                if FACILITY.search(r["city"]):
                    rows.remove(r)
                    by.pop(norm(r["city"]), None)
                    stats["facility-dropped"] += 1
                    continue
                planned = planned_parent(r["city"])
                parent = planned or conditional_parent(r["city"])
                if not parent or not plausible_name(parent):
                    continue
                target = by.get(norm(parent))
                if target is None:
                    if not planned:
                        continue        # no evidence this parent is a real place
                    target = {"city": parent, "tier": "locality",
                              "aka": [], "src": sorted(set(r["src"]))}
                    rows.append(target)
                    by[norm(parent)] = target
                    stats["parent-created"] += 1
                if norm(r["city"]) != norm(target["city"]):
                    target["aka"] = sorted(set(target["aka"]) | {r["city"]})
                target["src"] = sorted(set(target["src"]) | set(r["src"]))
                if target["tier"] == "locality" and r["tier"] != "locality":
                    target["tier"] = r["tier"]
                rows.remove(r)
                by.pop(norm(r["city"]), None)
                stats["fragment-folded"] += 1

            # Folding can land two rows on the same name, or land a row on a
            # name another row already claims as an alias ("Gurgaon" folded to
            # a city while Gurugram held it as an alias). Reconcile once, here,
            # rather than hoping each path upholds the invariant.
            # Keyed on canon(), the same key the dataset itself is built and
            # tested on. An earlier version reconciled on norm(), so two rows
            # that differ in spelling but share a canonical key - "Saraikela"
            # and "Saraikala" - still collided.
            merged = {}
            for r in rows:
                k = canon(r["city"]) or norm(r["city"])
                if k in merged:
                    keep = merged[k]
                    keep["aka"] = sorted(set(keep["aka"]) | set(r["aka"]))
                    keep["src"] = sorted(set(keep["src"]) | set(r["src"]))
                    if keep["tier"] == "locality" and r["tier"] != "locality":
                        keep["tier"] = r["tier"]
                    stats["post-fold-merged"] += 1
                else:
                    merged[k] = r
            rows[:] = list(merged.values())
            names = {norm(r["city"]) for r in rows}
            for r in rows:
                before = len(r["aka"])
                r["aka"] = [a for a in r["aka"]
                            if norm(a) != norm(r["city"]) and norm(a) not in names]
                stats["post-fold-alias-dropped"] += before - len(r["aka"])

            # Alias bloat: one locality can absorb twenty fragments. Keep the
            # most useful few - shortest first, since those are what people
            # actually type.
            for r in rows:
                if len(r["aka"]) > 8:
                    stats["aliases-capped"] += len(r["aka"]) - 8
                    r["aka"] = sorted(sorted(r["aka"], key=lambda a: (len(a), a))[:8])
            rows.sort(key=lambda x: x["city"])
    return stats


if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    s = apply(doc)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in s.most_common():
        print(f"  {k}: {v}")
    n = sum(len(r) for v in doc["places"].values() for r in v.values())
    print(f"\nplaces {n}")
