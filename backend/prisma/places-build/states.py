"""Canonical states and union territories of India, with the spellings people
actually type.

Both source datasets disagree with each other and with current usage: India
Post still writes "Pondicherry", "Chattisgarh", "Megalaya" and
"Andaman and Nico.In.", keeps Ladakh inside Jammu and Kashmir and lists Daman
and Diu apart from Dadra and Nagar Haveli; GeoNames has Ladakh separate and
the two UTs merged. Everything is mapped onto this one list.
"""

# canonical name -> alternate spellings a seller might type
STATES: dict[str, list[str]] = {
    "Andhra Pradesh": ["AP"],
    "Arunachal Pradesh": [],
    "Assam": [],
    "Bihar": [],
    "Chhattisgarh": ["Chattisgarh", "Chatisgarh"],
    "Goa": [],
    "Gujarat": [],
    "Haryana": [],
    "Himachal Pradesh": ["HP"],
    "Jharkhand": [],
    "Karnataka": ["Mysore State"],
    "Kerala": ["Keralam"],
    "Madhya Pradesh": ["MP"],
    "Maharashtra": ["Maharastra"],
    "Manipur": [],
    "Meghalaya": ["Megalaya"],
    "Mizoram": [],
    "Nagaland": [],
    "Odisha": ["Orissa"],
    "Punjab": [],
    "Rajasthan": ["Rajastan"],
    "Sikkim": [],
    "Tamil Nadu": ["Tamilnadu", "Madras State"],
    "Telangana": ["Telengana"],
    "Tripura": [],
    "Uttar Pradesh": ["UP"],
    "Uttarakhand": ["Uttaranchal"],
    "West Bengal": ["Bengal"],
    # union territories
    "Andaman and Nicobar Islands": ["Andaman and Nicobar", "Andaman & Nicobar", "Andamans"],
    "Chandigarh": [],
    "Dadra and Nagar Haveli and Daman and Diu": [
        "Dadra and Nagar Haveli", "Daman and Diu", "Daman & Diu", "Silvassa",
    ],
    "Delhi": ["New Delhi", "NCT of Delhi", "National Capital Territory of Delhi"],
    "Jammu and Kashmir": ["J&K", "Jammu & Kashmir"],
    "Ladakh": [],
    "Lakshadweep": ["Laccadives"],
    "Puducherry": ["Pondicherry", "Pondy"],
}

# how each source spells them -> canonical
SOURCE_STATE = {
    # India Post
    "andaman and nico.in.": "Andaman and Nicobar Islands",
    "chattisgarh": "Chhattisgarh",
    "dadra and nagar hav.": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "megalaya": "Meghalaya",
    "pondicherry": "Puducherry",
    # GeoNames
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "orissa": "Odisha",
}

def canonical_state(raw: str) -> str:
    s = " ".join((raw or "").split())
    if not s:
        return ""
    key = s.lower()
    if key in SOURCE_STATE:
        return SOURCE_STATE[key]
    for name in STATES:
        if name.lower() == key:
            return name
    for name, alts in STATES.items():
        if any(a.lower() == key for a in alts):
            return name
    return ""
