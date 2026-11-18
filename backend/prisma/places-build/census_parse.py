import glob, html as H, json, os, re, sys, collections
sys.path.insert(0, ".")
from resolve import resolve
from translit import plausible_name, tidy_case

# citypopulation uses 36 different status strings for what is, for an address
# form, the same thing: a town. Classify by pattern rather than enumerate, or
# legitimate bodies (Municipal Board (NPP), Town Municipal Council, Notified
# Area Council...) get silently skipped.
SKIP_STATUS = re.compile(r"^(District|Union Territory|State|Gram Panchayat)", re.I)

def tier_of(status: str) -> str:
    if SKIP_STATUS.match(status):
        return ""
    s = status.lower()
    if "census town" in s:
        return "census town"
    if "corporation" in s or s.startswith("city"):
        return "corporation"
    if "cantonment" in s:
        return "cantonment"
    if re.search(r"municipal|nagar|town|notified|township|industrial", s):
        return "municipality"
    return ""

# citypopulation leaves the district cell EMPTY for a corporation that covers a
# whole district, which dropped ten of the most important cities in the country
# (Delhi, New Delhi, Greater Mumbai, Hyderabad, Siliguri, Imphal). It also
# names some corporations differently from India Post.
BLANK_DISTRICT = {
    ("Delhi", "Delhi"): "Central Delhi",
    ("Delhi", "New Delhi"): "New Delhi",
    ("Delhi", "Delhi Cantonment"): "New Delhi",
    ("Maharashtra", "Greater Mumbai"): "Mumbai City",
    ("Telangana", "Hyderabad"): "Hyderabad",
    ("West Bengal", "Siliguri"): "Darjeeling",
    ("Manipur", "Imphal"): "Imphal West",
    ("Manipur", "Lilong"): "Thoubal",
    ("Madhya Pradesh", "Amlai"): "Shahdol",
    ("Uttarakhand", "Devaprayag"): "Tehri Garhwal",
}
# the census name is a compound or a variant of the name India Post uses
CENSUS_RENAME = {
    ("Maharashtra", "Greater Mumbai"): "Mumbai",
    ("West Bengal", "Haora"): "Howrah",
    # NOT mapped to "Hubballi": doing that merged the twin city and left
    # Dharwad - a district HQ with its own municipal identity - with no town
    # row at all. The compound keeps its own row and the two halves become
    # aliases via COMPOUND_SPLIT below.
    ("Karnataka", "Hubli-Dharwad"): "Hubli-Dharwad",
    ("Delhi", "Delhi"): "Delhi",
}

rows = collections.defaultdict(dict)
stats = collections.Counter()
for path in sorted(glob.glob("../census/*.html")):
    base = os.path.basename(path)
    if base.startswith("_"): continue
    state_file = base[:-5].replace("_", " ")
    body = open(path, encoding="utf-8", errors="replace").read()
    for tr in re.findall(r"<tr[^>]*>.*?</tr>", body, re.S):
        n = re.search(r'class="rname"[^>]*>.*?<span itemprop="name">.*?>([^<]+)</a>', tr, re.S)
        s = re.search(r'class="rstatus">([^<]*)<', tr)
        a = re.search(r'class="radm[^"]*">([^<]*)<', tr)
        if not (n and s): continue
        status = H.unescape(s.group(1)).strip()
        tier = tier_of(status)
        if not tier:
            stats[f"skip:{status}"] += 1
            continue
        name = tidy_case(H.unescape(n.group(1)).strip())
        dist_raw = H.unescape(a.group(1)).strip() if a else ""
        state, district, _ = resolve(state_file, dist_raw)
        if not district:
            fixed = BLANK_DISTRICT.get((state or state_file.strip(), name))
            if fixed:
                state, district = (state or state_file.strip()), fixed
        if not district:
            stats["no-district"] += 1
            continue
        if not plausible_name(name):
            stats["implausible-name"] += 1
            continue
        name = CENSUS_RENAME.get((state, name), name)
        key = re.sub(r"[^a-z]", "", name.lower())
        rows[(state, district)].setdefault(key, {"name": name, "tier": tier})
        stats["kept"] += 1

tot = sum(len(v) for v in rows.values())
print(f"census towns kept: {tot}  across {len(rows)} (state,district) pairs")
for k, v in stats.most_common(10): print(f"  {k}: {v}")
by_state = collections.Counter()
for (st, d), v in rows.items(): by_state[st] += len(v)
print()
for st, n in sorted(by_state.items()): print(f"  {st:44} {n}")
json.dump({f"{st}|{d}": list(v.values()) for (st, d), v in rows.items()},
          open("census_towns.json", "w", encoding="utf-8"), ensure_ascii=False)
