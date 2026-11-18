"""Independent checks over the built dataset. Each returns a list of failures."""
import json, os, re, sys, collections
sys.path.insert(0, ".")
from translit import norm, canon, plausible_name, JUNK
from states import STATES

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

DOC = json.load(open(DATA_FILE, encoding="utf-8"))
REG = json.load(open("districts.json", encoding="utf-8"))
PLACES, DISTRICTS = DOC["places"], DOC["districts"]
VALID_TIERS = {"locality", "census town", "municipality", "corporation", "cantonment"}
# A place must be attested by one of these. state-ulb-register is a state
# government's own register of urban local bodies (e.g. Uttarakhand UDD,
# Maharashtra DMA, Kerala LSGD) - used for ULBs that postal and census data miss.
OFFICIAL_SOURCES = {"indiapost", "census", "state-ulb-register", "district-portal"}

# Test tables name places as they were when each finding was made; follow the
# recorded renames (Kerala -> Keralam, 2026) so the tables can stay as written.
_RENAMES = {}
_DRENAMES = {}
for _f in sorted(os.listdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrections"))):
    if _f.endswith(".json"):
        for _op in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrections", _f), encoding="utf-8"))["ops"]:
            if _op["op"] == "state_rename": _RENAMES[_op["state"]] = _op["to"]
            if _op["op"] == "district_rename": _DRENAMES[(_op["state"], _op["district"])] = _op["to"]
def ST(s): return _RENAMES.get(s, s)
def DT(s, d):
    """District as named today, for a (state, district) written before a rename."""
    for k, v in _RENAMES.items():
        if v == s and (k, d) in _DRENAMES: return _DRENAMES[(k, d)]
    return _DRENAMES.get((s, d), d)

def t01_states():
    f = []
    expected = {ST(s) for s in STATES}
    for s in expected:
        if s not in PLACES: f.append(f"state missing from places: {s}")
    for s in PLACES:
        if s not in expected: f.append(f"unexpected state: {s}")
    return f

def t02_district_counts():
    f = []
    for s, v in REG.items():
        want = v["official_count"]
        got = len(v["districts"])
        if got != want: f.append(f"{s}: registry has {got} districts, official_count {want}")
        if len(PLACES.get(s, {})) != want:
            f.append(f"{s}: places tree has {len(PLACES.get(s,{}))} districts, expected {want}")
    return f

def t03_district_uniqueness():
    f = []
    for s, ds in DISTRICTS.items():
        seen = collections.Counter(norm(d["name"]) for d in ds)
        f += [f"{s}: duplicate district {k}" for k, n in seen.items() if n > 1]
    return f

def t04_district_alias_collisions():
    f = []
    for s, ds in DISTRICTS.items():
        official = {norm(d["name"]) for d in ds}
        for d in ds:
            for a in d["aliases"]:
                if norm(a) == norm(d["name"]): f.append(f"{s}/{d['name']}: self-alias")
                elif norm(a) in official: f.append(f"{s}/{d['name']}: alias '{a}' is another district")
    return f

def t05_city_uniqueness():
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            seen = collections.Counter(canon(r["city"]) or norm(r["city"]) for r in rows)
            f += [f"{s}/{d}: duplicate city key {k}" for k, n in seen.items() if n > 1]
    return f

def t06_alias_never_another_city():
    """The safety invariant: an alias must never be another city in the district."""
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            official = {norm(r["city"]) for r in rows}
            for r in rows:
                for a in r["aka"]:
                    if norm(a) == norm(r["city"]): f.append(f"{s}/{d}/{r['city']}: self-alias")
                    elif norm(a) in official:
                        f.append(f"{s}/{d}: '{a}' is an alias of {r['city']} AND a city")
    return f

def t07_name_quality():
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            for r in rows:
                if not r["city"].strip(): f.append(f"{s}/{d}: blank city")
                # The junk filter guards against postal noise ("Army Camp"); a name
                # taken from a state ULB register is an official body's name
                # (Coopers Camp Notified Area Authority), so it is not overruled.
                elif JUNK.search(r["city"]) and "state-ulb-register" not in r["src"]:
                    f.append(f"{s}/{d}: junk name {r['city']!r}")
                elif re.fullmatch(r"[A-Z]{2,4}", r["city"]): f.append(f"{s}/{d}: code-like {r['city']!r}")
                elif len(r["city"]) > 48: f.append(f"{s}/{d}: overlong {r['city']!r}")
    return f

def t08_tiers_and_sources():
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            for r in rows:
                if r["tier"] not in VALID_TIERS: f.append(f"{s}/{d}/{r['city']}: bad tier {r['tier']}")
                if not r["src"]: f.append(f"{s}/{d}/{r['city']}: no source")
                if not (OFFICIAL_SOURCES & set(r["src"])):
                    f.append(f"{s}/{d}/{r['city']}: no OFFICIAL source, only {r['src']}")
    return f

KNOWN_CITIES = [
 ("Maharashtra","Mumbai City","Mumbai"),("Tamil Nadu","Chennai","Chennai"),
 ("West Bengal","Kolkata","Kolkata"),("Karnataka","Bengaluru Urban","Bengaluru"),
 # India Post files New Delhi GPO under Central Delhi, not New Delhi district,
 # so this one is checked at state level - the postal attribution is the fact,
 # my geographic assumption was not.
 ("Delhi",None,"New Delhi"),("Telangana","Hyderabad","Hyderabad"),
 ("Gujarat","Ahmedabad","Ahmedabad"),("Rajasthan","Jaipur","Jaipur"),
 ("Uttar Pradesh","Lucknow","Lucknow"),("Kerala","Ernakulam","Kochi"),
 ("Punjab","Ludhiana","Ludhiana"),("Bihar","Patna","Patna"),
 ("Madhya Pradesh","Indore","Indore"),("Odisha","Khordha","Bhubaneswar"),
 ("Assam","Kamrup Metropolitan","Guwahati"),("Ladakh","Leh","Leh"),
 ("Puducherry","Karaikal","Karaikal"),("Goa","North Goa","Panaji"),
]
def t09_known_cities():
    f = []
    for s, d, city in KNOWN_CITIES:
        d = DT(s, d) if d else d; s = ST(s)
        rows = ([r for rs in PLACES.get(s, {}).values() for r in rs] if d is None
                else PLACES.get(s, {}).get(d, []))
        hit = any(norm(r["city"]) == norm(city) or any(norm(a) == norm(city) for a in r["aka"])
                  for r in rows)
        if not hit:
            where = s if d is None else f"{s}/{d}"
            f.append(f"{city} not found in {where} ({len(rows)} rows there)")
    return f

KNOWN_ALIASES = [
 ("Maharashtra","Bombay City","Mumbai City"),("Tamil Nadu","Madras","Chennai"),
 ("West Bengal","Calcutta","Kolkata"),("Karnataka","Bangalore","Bengaluru"),
 ("Kerala","Trivandrum","Thiruvananthapuram"),("Kerala","Calicut","Kozhikode"),
 ("Uttar Pradesh","Allahabad","Prayagraj"),("Maharashtra","Poona","Pune"),
]
def t10_district_alias_lookup():
    """A historical name must resolve to the right DISTRICT."""
    f = []
    for s, typed, want in KNOWN_ALIASES:
        s = ST(s)
        hit = None
        for d in DISTRICTS[s]:
            if norm(d["name"]) == norm(typed) or any(norm(a) == norm(typed) for a in d["aliases"]):
                hit = d["name"]; break
        if hit is None: f.append(f"{s}: '{typed}' resolves to no district")
    return f

def t11_relocations():
    """Rows India Post files under the wrong state must have moved."""
    f = []
    if "Leh" in PLACES.get("Jammu and Kashmir", {}): f.append("Leh still under J&K")
    if not PLACES.get("Ladakh", {}).get("Leh"): f.append("Ladakh/Leh is empty")
    if "Karaikal" in PLACES.get("Tamil Nadu", {}): f.append("Karaikal still under Tamil Nadu")
    if not PLACES.get("Puducherry", {}).get("Karaikal"): f.append("Puducherry/Karaikal is empty")
    return f

def t12_alias_hygiene():
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            for r in rows:
                if len(set(norm(a) for a in r["aka"])) != len(r["aka"]):
                    f.append(f"{s}/{d}/{r['city']}: duplicate aliases")
                for a in r["aka"]:
                    if not plausible_name(a): f.append(f"{s}/{d}/{r['city']}: bad alias {a!r}")
    return f

def t13_random_deep_sample():
    """A different slice of the data on every run.

    The other checks are deterministic, so running them repeatedly proves
    nothing new. This one samples places at random and re-derives their
    invariants from scratch, so ten runs with ten seeds genuinely cover ten
    different parts of a 153k-row dataset.
    """
    import random
    seed = int(os.environ.get("VERIFY_SEED", "0"))
    rng = random.Random(seed)
    flat = [(s, d, r) for s, ds in PLACES.items() for d, rows in ds.items() for r in rows]
    if not flat:
        return ["no places at all"]
    sample = rng.sample(flat, min(2000, len(flat)))
    official_by = {}
    f = []
    for s, d, r in sample:
        if s not in {ST(x) for x in STATES}: f.append(f"sample: bad state {s}")
        if d not in {x["name"] for x in DISTRICTS[s]}:
            f.append(f"sample: {s}/{d} is not a verified district")
        if r["tier"] not in VALID_TIERS: f.append(f"sample: {s}/{d}/{r['city']} bad tier")
        if not r["city"].strip() or len(r["city"]) > 48:
            f.append(f"sample: {s}/{d} bad city {r['city']!r}")
        if JUNK.search(r["city"]) and "state-ulb-register" not in r["src"]:
            f.append(f"sample: {s}/{d} junk {r['city']!r}")
        if not (OFFICIAL_SOURCES & set(r["src"])):
            f.append(f"sample: {s}/{d}/{r['city']} unofficial")
        key = (s, d)
        if key not in official_by:
            official_by[key] = {norm(x["city"]) for x in PLACES[s][d]}
        for a in r["aka"]:
            if norm(a) == norm(r["city"]): f.append(f"sample: {s}/{d}/{r['city']} self-alias")
            elif norm(a) in official_by[key]:
                f.append(f"sample: {s}/{d} alias {a!r} collides with a city")
            elif not plausible_name(a): f.append(f"sample: {s}/{d} bad alias {a!r}")
    return f

CITY_ALIAS_CASES = [
 ("Maharashtra","Bombay","Mumbai"),("Tamil Nadu","Madras","Chennai"),
 ("West Bengal","Calcutta","Kolkata"),("Karnataka","Bangalore","Bengaluru"),
 ("Karnataka","Mysore","Mysuru"),("Kerala","Tellicherry","Thalassery"),
 ("Kerala","Calicut","Kozhikode"),("Kerala","Trivandrum","Thiruvananthapuram"),
 ("Uttar Pradesh","Allahabad","Prayagraj"),("Maharashtra","Poona","Pune"),
 ("Andhra Pradesh","Vizag","Visakhapatnam"),("Assam","Gauhati","Guwahati"),
 ("Maharashtra","Aurangabad","Chhatrapati Sambhajinagar"),
 ("Himachal Pradesh","Simla","Shimla"),("Haryana","Gurgaon","Gurugram"),
]
def t14_city_alias_lookup():
    """Typing a historical city name must land on the current city."""
    f = []
    for s, typed, want in CITY_ALIAS_CASES:
        s = ST(s)
        found = None
        for d, rows in PLACES.get(s, {}).items():
            for r in rows:
                if norm(r["city"]) == norm(typed) or any(norm(a) == norm(typed) for a in r["aka"]):
                    found = r["city"]; break
            if found: break
        if found is None: f.append(f"{s}: '{typed}' matches no city")
        elif norm(found) != norm(want): f.append(f"{s}: '{typed}' -> {found}, expected {want}")
    return f

def t15_no_stale_canonical():
    """A renamed city must not still be stored under its old name."""
    from citynames import CITY_RENAMES
    f = []
    for (s, old), new in CITY_RENAMES.items():
        s = ST(s)
        if norm(old) == norm(new): continue
        for d, rows in PLACES.get(s, {}).items():
            for r in rows:
                if norm(r["city"]) == norm(old):
                    f.append(f"{s}/{d}: city still stored as '{old}' (should be '{new}')")
    return f

# Findings from the regional audits, kept as tests so they cannot regress.
AUDIT_PLACEMENT = [
 ("Gujarat","Gir Somnath","Veraval-Patan"),("Gujarat","Aravalli","Modasa"),
 ("Gujarat","Morbi","Morbi"),("Gujarat","Devbhumi Dwarka","Khambhalia"),
 ("Gujarat","Botad","Botad"),("Gujarat","Mahisagar","Lunawada"),
 ("Gujarat","Chhota Udaipur","Bodeli"),
 ("Maharashtra","Palghar","Vasai-Virar City"),("Maharashtra","Palghar","Palghar"),
 ("Punjab","Pathankot","Pathankot"),("Punjab","Fazilka","Fazilka"),
 ("Punjab","Shaheed Bhagat Singh Nagar","Banga"),
 ("Uttar Pradesh","Hapur","Hapur"),("Uttar Pradesh","Sambhal","Sambhal"),
 ("West Bengal","Paschim Bardhaman","Asansol"),
 ("West Bengal","Paschim Bardhaman","Durgapur"),
]
def t16_audit_placement():
    """A town the audits found misfiled must sit in the right district."""
    f = []
    for s, d, city in AUDIT_PLACEMENT:
        d = DT(s, d); s = ST(s)
        rows = PLACES.get(s, {}).get(d, [])
        if not any(norm(r["city"]) == norm(city) for r in rows):
            f.append(f"{city} is not in {s}/{d}")
    return f

AUDIT_SPELLING = [
 ("Gujarat","Ahmedabad","Ahmadabad"),("Gujarat","Mehsana","Mahesana"),
 ("Gujarat","Morbi","Morvi"),("Himachal Pradesh","Dharamshala","Dharmsala"),
 ("Maharashtra","Ahilyanagar","Ahmadnagar"),("Bihar","Danapur","Dinapur Nizamat"),
 ("Odisha","Jayapur","Jeypore"),("Jharkhand","Hazaribagh","Hazaribag"),
 ("Rajasthan","Dholpur","Dhaulpur"),("Punjab","Sri Muktsar Sahib","Muktsar"),
]
def t17_audit_spelling():
    """The name people write is canonical; the old form survives as an alias."""
    f = []
    for s, want, old in AUDIT_SPELLING:
        s = ST(s)
        # A state can have several places of one name; the finding is about the
        # town, so a same-named locality elsewhere must not stand in for it.
        same = [r for rows in PLACES.get(s, {}).values() for r in rows if norm(r["city"]) == norm(want)]
        hit = next((r for r in same if r["tier"] != "locality"), same[0] if same else None)
        if hit is None:
            f.append(f"{s}: canonical '{want}' missing")
        elif not any(norm(a) == norm(old) for a in hit["aka"]):
            f.append(f"{s}/{want}: old spelling '{old}' is not an alias")
        for d, rows in PLACES.get(s, {}).items():
            for r in rows:
                if norm(r["city"]) == norm(old) and r["tier"] != "locality":
                    f.append(f"{s}/{d}: town still stored as '{old}'")
    return f

AUDIT_BAD_ALIASES = [
 ("Uttar Pradesh","Prayagraj","Ayodhya","Faizabad"),
 ("West Bengal",None,"Murshidabad","Baharampur"),
 ("Jharkhand",None,"Ghorabandha","Gurabanda"),
 ("Goa",None,"Goa Velha","Old Goa"),
 ("Maharashtra",None,"Sangli","Turmeric city"),
 ("Uttar Pradesh",None,"Hathras","Mahamaya Nagar"),
]
def t18_audit_bad_aliases():
    """An alias naming a different place must stay removed."""
    f = []
    for s, only_d, city, bad in AUDIT_BAD_ALIASES:
        s = ST(s)
        for d, rows in PLACES.get(s, {}).items():
            if only_d and d != only_d: continue
            for r in rows:
                if norm(r["city"]) == norm(city) and any(norm(a) == norm(bad) for a in r["aka"]):
                    f.append(f"{s}/{d}/{city}: '{bad}' is back as an alias")
    return f

def t19_towns_present_where_expected():
    """A district with many places must not have zero towns - that was the
    symptom of the West Bengal tier collapse, where 225 municipalities were
    stored as plain localities because a census district label never resolved."""
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            if len(rows) >= 300 and not any(r["tier"] != "locality" for r in rows):
                f.append(f"{s}/{d}: {len(rows)} places but zero towns")
    return f

# November 2026 official-source audit: one entry per finding class, so none can regress.
AUDIT4_PLACEMENT = [
 ("Delhi","Outer North Delhi","Narela"),("Delhi","Outer North Delhi","Bawana"),
 ("Delhi","Central North Delhi","Shalimar Bagh"),("Delhi","South East Delhi","Jait Pur"),
 ("Delhi","East Delhi","Seelampur"),("Haryana","Hansi","Hansi"),("Haryana","Charkhi Dadri","Charkhi Dadri"),
 ("Punjab","Malerkotla","Ahmedgarh"),("Uttar Pradesh","Amethi","Musafirkhana"),("Uttar Pradesh","Amethi","Gauriganj"),
 ("Tamil Nadu","Tenkasi","Tenkasi"),("Tamil Nadu","Chengalpattu","Tambaram"),("Tamil Nadu","Ranipet","Arcot"),
 ("Karnataka","Bengaluru Rural","Hosakote"),("Karnataka","Vijayapura","Vijayapura"),
 ("Kerala","Wayanad","Mananthavady"),("Odisha","Kataka","Kataka"),("Uttarakhand","Pithoragarh","Berinag"),
]
AUDIT4_GONE_ALIASES = [
 ("Karnataka","Bengaluru Rural","Vijayapura","Bijapur"),   # a city 500 km away
 ("Kerala","Kannur","Kottayam-Malabar","Kottayam"),        # a district 250 km away
 ("Haryana","Mahendragarh","Mahendragarh","Manendragarh"), # a town in Chhattisgarh
 ("Uttar Pradesh","Gautam Buddha Nagar","Noida","Gautam Buddha Nagar"),
]
def t20_audit4():
    f = []
    for s, d, city in AUDIT4_PLACEMENT:
        d = DT(s, d); s = ST(s)
        if not any(norm(r["city"]) == norm(city) for r in PLACES.get(s, {}).get(d, [])):
            f.append(f"{city} is not in {s}/{d}")
    for s, d, city, bad in AUDIT4_GONE_ALIASES:
        s = ST(s)
        for r in PLACES.get(s, {}).get(d, []):
            if norm(r["city"]) == norm(city) and any(norm(a) == norm(bad) for a in r["aka"]):
                f.append(f"{s}/{d}/{city}: '{bad}' is back as an alias")
    if "Kerala" not in PLACES: f.append("Kerala missing (owner decision: Kerala stays canonical, Keralam is an alias)")
    for s, d in [("Meghalaya","Ri Bhoi"),("Odisha","Kataka"),("Odisha","Baleshwar")]:
        if d not in PLACES.get(s, {}): f.append(f"{s}: district '{d}' missing")
    empty = [d for d, rows in PLACES.get("Delhi", {}).items() if not rows]
    if empty: f.append(f"Delhi districts still empty: {empty}")
    return f

def t21_district_alias_unique():
    """An alias two districts of one state both claim sends some users to the
    wrong one - North Arcot sat on Vellore and Tiruvannamalai until Nov 2026."""
    f = []
    for s, ds in DISTRICTS.items():
        owners = collections.defaultdict(set)
        for d in ds:
            for a in d["aliases"]: owners[norm(a)].add(d["name"])
        f += [f"{s}: alias '{a}' claimed by {sorted(o)}" for a, o in owners.items() if len(o) > 1]
    return f

def t22_town_tier_is_attested():
    """A town tier (corporation, municipality, census town, cantonment) must be
    backed by a census or municipal-register source. India Post knows post
    offices, not municipal status: a postal-only row claiming a tier is how
    eight ordinary villages called Pimpri came to be stored as corporations."""
    f = []
    for s, ds in PLACES.items():
        for d, rows in ds.items():
            for r in rows:
                if r["tier"] != "locality" and not ({"census", "state-ulb-register", "district-portal"} & set(r["src"])):
                    f.append(f"{s}/{d}/{r['city']}: tier {r['tier']} with sources {r['src']}")
    return f

TESTS = [(n, f) for n, f in sorted(globals().items()) if n.startswith("t") and callable(f)]

if __name__ == "__main__":
    bad = 0
    for name, fn in TESTS:
        fails = fn()
        status = "PASS" if not fails else f"FAIL ({len(fails)})"
        print(f"  {name:34} {status}")
        for x in fails[:6]: print(f"        {x}")
        if len(fails) > 6: print(f"        ... {len(fails)-6} more")
        bad += len(fails)
    print(f"\n{'ALL CHECKS PASS' if not bad else f'{bad} FAILURES'}")
    sys.exit(1 if bad else 0)
