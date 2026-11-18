import os
"""Carry the district layer's canonical/alias knowledge down to the cities.

India Post has not followed the renames: it still writes "Bangalore",
"Allahabad", "Aurangabad". The verified district registry knows the current
name and the old one, so two rules propagate that downwards:

  1. CITY_RENAMES names the cities that were themselves renamed. An earlier
     version derived this from the district registry instead, which renamed
     the city to the DISTRICT's name - turning Bangalore into "Bengaluru
     Urban" and Mumbai into "Mumbai City". A city and its district do not
     share a name, so this has to be stated, not derived.
  2. A city that already carries the district's current name inherits the
     district's aliases. Mumbai (in Mumbai City) gains Bombay.

Plus a short curated list for TOWNS that were renamed but are not districts,
so nothing in the district registry can supply them.
"""
import json, sys
sys.path.insert(0, ".")
from translit import norm, plausible_name

# The built dataset lives with the other seed data, not in this folder, so
# the pipeline updates the file the seed script actually reads.
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "india-places.json")

# Cities renamed in their own right. Keyed by state so a same-named place in
# another state is untouched.
CITY_RENAMES = {
    ("Karnataka", "Bangalore"): "Bengaluru",
    ("Karnataka", "Mysore"): "Mysuru",
    ("Karnataka", "Mangalore"): "Mangaluru",
    ("Karnataka", "Belgaum"): "Belagavi",
    ("Karnataka", "Hubli"): "Hubballi",
    ("Karnataka", "Gulbarga"): "Kalaburagi",
    ("Karnataka", "Bellary"): "Ballari",
    ("Karnataka", "Bijapur"): "Vijayapura",
    ("Karnataka", "Shimoga"): "Shivamogga",
    ("Karnataka", "Tumkur"): "Tumakuru",
    ("Maharashtra", "Bombay"): "Mumbai",
    ("Maharashtra", "Poona"): "Pune",
    ("Maharashtra", "Aurangabad"): "Chhatrapati Sambhajinagar",
    ("Maharashtra", "Osmanabad"): "Dharashiv",
    ("Tamil Nadu", "Madras"): "Chennai",
    ("West Bengal", "Calcutta"): "Kolkata",
    ("Kerala", "Calicut"): "Kozhikode",
    ("Kerala", "Trivandrum"): "Thiruvananthapuram",
    ("Kerala", "Quilon"): "Kollam",
    ("Kerala", "Alleppey"): "Alappuzha",
    ("Kerala", "Trichur"): "Thrissur",
    ("Kerala", "Cannanore"): "Kannur",
    ("Uttar Pradesh", "Allahabad"): "Prayagraj",
    ("Uttar Pradesh", "Cawnpore"): "Kanpur",
    ("Haryana", "Gurgaon"): "Gurugram",
    ("Gujarat", "Baroda"): "Vadodara",
    ("Himachal Pradesh", "Simla"): "Shimla",
    ("Goa", "Panjim"): "Panaji",
    ("Odisha", "Cuttack"): "Cuttack",
}

# Where an old name also names a different place elsewhere in the state, the
# rename is pinned to one district. "Mangalore" belongs to Mangaluru in
# Dakshina Kannada, not to the Mangaluru villages in Kalaburagi and Koppal.
RENAME_DISTRICT = {
    ("Karnataka", "Mangalore"): "Dakshina Kannada",
    ("Karnataka", "Belgaum"): "Belagavi",
    ("Karnataka", "Tumkur"): "Tumakuru",
    ("Karnataka", "Mysore"): "Mysuru",
    ("Karnataka", "Bellary"): "Ballari",
    ("Karnataka", "Bijapur"): "Vijayapura",
    ("Karnataka", "Gulbarga"): "Kalaburagi",
    ("Karnataka", "Shimoga"): "Shivamogga",
    ("Karnataka", "Bangalore"): "Bengaluru Urban",
    ("Gujarat", "Baroda"): "Vadodara",
    ("Maharashtra", "Bombay"): "Mumbai City",
    ("Maharashtra", "Poona"): "Pune",
    # Kerala was missing from this map, so "Quilon" landed on a Kozhikode
    # village, "Cannanore" on a Kasaragod village and "Tellicherry" on a
    # Thrissur village - the very fault the pin exists to prevent.
    ("Kerala", "Quilon"): "Kollam",
    ("Kerala", "Cannanore"): "Kannur",
    ("Kerala", "Calicut"): "Kozhikode",
    ("Kerala", "Trivandrum"): "Thiruvananthapuram",
    ("Kerala", "Alleppey"): "Alappuzha",
    ("Kerala", "Trichur"): "Thrissur",
    ("Kerala", "Tellicherry"): "Kannur",
    ("Uttar Pradesh", "Allahabad"): "Prayagraj",
    ("Uttar Pradesh", "Cawnpore"): "Kanpur Nagar",
    ("Tamil Nadu", "Madras"): "Chennai",
    ("West Bengal", "Calcutta"): "Kolkata",
    ("Haryana", "Gurgaon"): "Gurugram",
    ("Himachal Pradesh", "Simla"): "Shimla",
}

# town renames where the town is not a district (district aliases cannot reach these)
TOWN_ALIASES = {
    ("Kerala", "Thalassery"): ["Tellicherry"],
    ("Kerala", "Vadakara"): ["Badagara", "Vatakara"],
    ("Kerala", "Koyilandy"): ["Quilandy"],
    ("Tamil Nadu", "Thoothukudi"): ["Tuticorin"],
    ("Tamil Nadu", "Udhagamandalam"): ["Ootacamund", "Ooty"],
    ("Tamil Nadu", "Nagercoil"): ["Nagarcoil"],
    ("Karnataka", "Mangaluru"): ["Mangalore"],
    ("Karnataka", "Hubballi"): ["Hubli"],
    ("Karnataka", "Belagavi"): ["Belgaum"],
    ("Maharashtra", "Navi Mumbai"): ["New Bombay"],
    ("West Bengal", "Baharampur"): ["Berhampore"],
    ("Odisha", "Baleshwar"): ["Balasore"],
    ("Uttar Pradesh", "Ayodhya"): ["Faizabad"],
    ("Gujarat", "Vadodara"): ["Baroda"],
    ("Madhya Pradesh", "Jabalpur"): ["Jubbulpore"],
    ("Bihar", "Munger"): ["Monghyr"],
    ("Assam", "Guwahati"): ["Gauhati"],
    ("Himachal Pradesh", "Shimla"): ["Simla"],
}

def apply(doc, reg):
    """Returns (renamed, merged, inherited, curated)."""
    renamed = merged = inherited = curated = 0
    for st, ds in doc["places"].items():
        dinfo = {d["name"]: d["aliases"] for d in reg[st]["districts"]}
        for d, rows in ds.items():
            aliases = dinfo.get(d, [])

            # --- rule 1: a renamed city -------------------------------------
            # If BOTH the old and new name are present as separate rows -
            # India Post writes Bangalore, the census writes Bengaluru - they
            # are one city recorded twice. Merge, do not skip: skipping leaves
            # a duplicate and the new name without the old as an alias.
            by = {norm(r["city"]): r for r in rows}
            for r in list(rows):
                new_name = CITY_RENAMES.get((st, r["city"]))
                if not new_name or norm(new_name) == norm(r["city"]):
                    continue
                target = by.get(norm(new_name))
                if target is not None and target is not r:
                    target["aka"] = sorted(set(target["aka"]) | {r["city"]} | set(r["aka"]))
                    if r["tier"] != "locality" and target["tier"] == "locality":
                        target["tier"] = r["tier"]
                    target["src"] = sorted(set(target["src"]) | set(r["src"]))
                    rows.remove(r)
                    by.pop(norm(r["city"]), None)
                    merged += 1
                else:
                    r["aka"] = sorted(set(r["aka"]) | {r["city"]})
                    by.pop(norm(r["city"]), None)
                    r["city"] = new_name
                    by[norm(new_name)] = r
                    renamed += 1

            official = {norm(r["city"]) for r in rows}

            # Rule 2 used to give the district's namesake city all of the
            # district's aliases. That is wrong whenever a district alias is
            # its headquarters TOWN rather than another spelling: Murshidabad
            # district is also known by its HQ Baharampur, so the city
            # Murshidabad acquired "Baharampur" - a different town that exists
            # in its own right. The same leak put the dissolved district names
            # "Jaipur Rural" and "Jodhpur Rural" onto the cities. Genuine city
            # renames are named explicitly in CITY_RENAMES instead.

            # --- rule 2: the historical name as an alias --------------------
            # Where the city is ALREADY stored under its current name, the old
            # name from CITY_RENAMES still has to be reachable: India Post
            # writes "Mumbai" and "Pune", so nothing would otherwise attach
            # "Bombay" or "Poona". Scoped by (state, district) where the old
            # name belongs to a different place elsewhere in the state -
            # "Mangalore" must not land on a Kalaburagi village.
            for r in rows:
                for (cst, old), new in CITY_RENAMES.items():
                    if cst != st or norm(new) != norm(r["city"]):
                        continue
                    want_d = RENAME_DISTRICT.get((st, old))
                    if want_d and want_d != d:
                        continue
                    if norm(old) in official or norm(old) == norm(r["city"]):
                        continue
                    if plausible_name(old) and old not in r["aka"]:
                        r["aka"] = sorted(set(r["aka"]) | {old})
                        inherited += 1

            # --- rule 3: curated town renames -------------------------------
            for r in rows:
                for a in TOWN_ALIASES.get((st, r["city"]), []):
                    if norm(a) not in official and norm(a) != norm(r["city"]):
                        r["aka"] = sorted(set(r["aka"]) | {a})
                        curated += 1
    # One sanitation pass over everything. Several rules write to `aka`, and a
    # name can reach it from the merge, the census swap or the inheritance; it
    # is cheaper to guarantee the invariant once here than to prove each path
    # upholds it.
    dropped = 0
    for st, ds in doc["places"].items():
        for d, rows in ds.items():
            for r in rows:
                clean, seen = [], {norm(r["city"])}
                for a in r["aka"]:
                    k = norm(a)
                    if not k or k in seen or not plausible_name(a):
                        dropped += 1
                        continue
                    seen.add(k)
                    clean.append(a)
                r["aka"] = clean
    return renamed, merged, inherited, curated, dropped

if __name__ == "__main__":
    doc = json.load(open(DATA_FILE, encoding="utf-8"))
    reg = json.load(open("districts.json", encoding="utf-8"))
    a, m, b, c, dropped = apply(doc, reg)
    json.dump(doc, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"cities renamed: {a}   duplicate old/new pairs merged: {m}")
    print(f"district aliases inherited by their namesake city: {b}")
    print(f"curated town aliases added: {c}")
    print(f"aliases dropped by final sanitation: {dropped}")
    n = sum(len(r["aka"]) for v in doc["places"].values() for rs in v.values() for r in rs)
    print(f"total city aliases now: {n}")
