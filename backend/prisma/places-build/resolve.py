"""Map a source's district label onto a canonical district.

This is the join everything depends on: a label that will not resolve means
every city under it is lost. Four passes, strongest first, so a weak rule can
never override a strong one.
"""
import json, re, sys
sys.path.insert(0, ".")
from translit import norm, canon, same_place
from states import canonical_state

REG = json.load(open("districts.json", encoding="utf-8"))
from corrections import WITHIN, MOVE, DROP_LABELS

# strip the decorations sources add
STRIP = re.compile(
    r"\s*\b(district|dist|distt|zila|zilla|division|revenue division|rural|urban)\b\.?", re.I)

def tidy(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").replace(".", " ").strip())
    s = STRIP.sub(" ", s)
    s = re.sub(r"[^A-Za-z0-9&()\- ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

_index = {}
for state, v in REG.items():
    exact, canonical, aliases = {}, {}, {}
    for d in v["districts"]:
        exact[norm(d["name"])] = d["name"]
        canonical.setdefault(canon(d["name"]), d["name"])
        for a in d["aliases"]:
            aliases[norm(a)] = d["name"]
            canonical.setdefault(canon(a), d["name"])
    _index[state] = {"exact": exact, "canon": canonical, "alias": aliases,
                     "names": [d["name"] for d in v["districts"]]}

def resolve(state_raw: str, district_raw: str):
    """-> (state, district, how) or (state, "", "") when it will not resolve."""
    state = canonical_state(state_raw)
    if not state:
        return "", "", ""
    raw = tidy(district_raw)
    if not raw:
        return state, "", ""
    k = norm(raw)
    # corrections first: they encode facts no string rule can derive
    if k in DROP_LABELS:
        return state, "", "dropped"
    if (state, k) in MOVE:
        return (*MOVE[(state, k)], "moved")
    if (state, k) in WITHIN:
        fixed = WITHIN[(state, k)]
        return (state, fixed, "corrected") if fixed else (state, "", "dropped")
    ix = _index[state]
    if k in ix["exact"]:
        return state, ix["exact"][k], "exact"
    if k in ix["alias"]:
        return state, ix["alias"][k], "alias"
    c = canon(raw)
    if c in ix["canon"]:
        return state, ix["canon"][c], "canon"
    # last resort: a transliteration variant of exactly one district
    hits = {n for n in ix["names"] if same_place(n, raw)}
    if len(hits) == 1:
        return state, hits.pop(), "variant"
    return state, "", ""
