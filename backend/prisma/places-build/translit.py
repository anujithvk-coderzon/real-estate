"""Deciding when two spellings are the same place.

Indian place names are romanised inconsistently, and the variance is
systematic: aspirated digraphs (zh/sh/th/dh/ch), doubled letters, and which
vowel of a class gets written. Folding exactly those three makes real variants
collide while different places stay apart.

This was tuned on Malayalam, where the variance is widest, and is applied to
the whole country. That is safe only because of how it is USED: it never
merges two names that an official source lists separately — it only attaches
an unofficial spelling to an official row, and only when exactly one row
matches. Over-folding therefore costs a missed alias, never a wrong merge.
Both properties are asserted in verify.py.
"""

import re
import unicodedata

def strip_marks(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c)
    )

def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", strip_marks(s).lower())

def canon(s: str) -> str:
    """Transliteration-canonical form.

        Kazhakkoottam / Kazhakuttam  -> kazakutam   (same place)
        Kattoor      / Kuttoor       -> katur/kutur (DIFFERENT places)
    """
    s = norm(s)
    for a, b in (("zh", "z"), ("sh", "s"), ("th", "t"), ("dh", "d"), ("ch", "c"),
                 ("bh", "b"), ("gh", "g"), ("kh", "k"), ("ph", "p")):
        s = s.replace(a, b)
    s = s.replace("y", "i").replace("w", "v")
    s = re.sub(r"[ae]", "a", s)
    s = re.sub(r"[iy]", "i", s)
    s = re.sub(r"[ou]", "u", s)
    return re.sub(r"(.)\1+", r"\1", s)

# Short all-caps forms that are genuine place names in daily use.
SHORT_ALIASES = {"KGF", "NTR", "GPO", "DNH", "MCB", "KCG", "GPM", "ASR", "SAS",
                 "SBS", "US", "AMC", "BBMP", "GHMC", "PCMC", "KDMC", "VVCMC"}

VOWELS = set("aeiouy")

def one_edit_ok(a: str, b: str) -> bool:
    """One character apart, and that character is a vowel or a doubling.

    A consonant swapped for a different consonant means a different place:
    Kannur / Mannur / Annur are three towns, and Pullur is not Pullut.
    """
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        d = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
        return len(d) == 1 and a[d[0]] in VOWELS and b[d[0]] in VOWELS
    lo, hi = (a, b) if len(a) < len(b) else (b, a)
    for i in range(len(hi)):
        if hi[:i] + hi[i + 1:] == lo:
            ch = hi[i]
            if ch in VOWELS:
                return True
            return (i > 0 and hi[i - 1] == ch) or (i + 1 < len(hi) and hi[i + 1] == ch)
    return False

# Pairs the rules would fold that are genuinely different places. canon()
# already separates most of them (Kattoor/Kuttoor -> katur/kutur,
# Surat/Sarat -> surat/sarat); this list is for anything only the one-edit
# rule reaches. verify.py prints every one-edit alias so this can be grown
# from evidence rather than guesswork.
DISTINCT_PAIRS = [
    ("Kattoor", "Kuttoor"),
    ("Surat", "Sarat"),
]
_DISTINCT = set()
for _a, _b in DISTINCT_PAIRS:
    _DISTINCT.add((norm(_a), norm(_b)))
    _DISTINCT.add((norm(_b), norm(_a)))


# A numbered or ordinal component is part of the identity, not a spelling
# choice: "Lore I" and "Lore II" are different villages, as are "Chak 1 KK"
# and "Chak 24 H", "Nerul Node II" and "Nerul Node III". norm() throws digits
# away and canon() then collapses the roman numerals, so these folded into one
# another. Any name carrying a number is compared strictly.
_NUMBERED = re.compile(r"(\d|\b(?:i{1,3}|iv|v|vi{1,3}|ix|x)\b|\b[a-z]\b)", re.I)


def numbered(s: str) -> bool:
    return bool(_NUMBERED.search(s or ""))


def match_rule(a: str, b: str) -> str:
    """Which rule says these are one place: "exact", "canon", "one-edit", or ""
    for no match. The caller records this so the weakest rule can be audited."""
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return ""
    if na == nb:
        return "exact"
    if (na, nb) in _DISTINCT:
        return ""
    if numbered(a) or numbered(b):
        return ""          # identity carries a number; only an exact match counts
    if canon(a) == canon(b):
        return "canon"
    if one_edit_ok(na, nb):
        return "one-edit"
    return ""


def same_place(a: str, b: str) -> bool:
    return match_rule(a, b) != ""

# ---- alias hygiene ----------------------------------------------------------

# A name that is not a place name at all.
JUNK = re.compile(
    r"\b(village ?office|panchayat ?office|collectorate|civil station|cantonment board|"
    r"villas?|apartments?|flats?|building|quarters|colony|junction|bus ?stand|"
    r"temple|church|mosque|gurudwara|school|college|university|hospital|"
    r"research (centre|center|station)|air ?force|naval|military|camp|"
    r"railway station|r\.?s\.?|port trust|industrial estate|estate office|"
    r"prison|jail|barracks?|secretariat|assembly|high court|courts?|"
    r"depot|refinery|colliery|dockyard|arsenal|ordnance|"
    r"sugar mills?|paper mills?|textile mills?|steel plant|thermal power|"
    r"sectt|collector[io]ate|aerodrome|airport|air ?port|cantt|"
    r"i\.?i\.?t|n\.?i\.?t|a\.?i\.?i\.?m\.?s|iiit|iim|bhel|ongc|isro|drdo|"
    r"polytechnic|institute|academy|ashram|dispensary|health ?centre|"
    r"post office|head office|sub office|branch office|telephone|exchange|"
    # buildings and offices India Post names as if they were places
    r"bhavan|bhawan|nilayam|sabha|vidhan|kutchery|kucthery|sectt|"
    r"d\.?c\.?\s*buildings?|buildings?|a\.?p\.?m\.?c|apmc|"
    r"i\.?t\.?i|r\.?t\.?o|l\.?i\.?c|b\.?s\.?n\.?l|hpbose|nsit|jntu|tnpl|"
    r"state bank|reserve bank|treasury|tahsil|tehsil office|block office)\b",
    re.I,
)

# "S.R.P.M", "A.P.S.P" - an initialism, not a place name.
INITIALISM = re.compile(r"^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$")


def tidy_case(name: str) -> str:
    """India Post writes some names in block capitals. Title-case those, and
    leave anything already mixed-case alone - "McLeod Ganj" and "DeNobili"
    must not be flattened."""
    n = " ".join((name or "").split())
    if not n or n != n.upper():
        return n
    return re.sub(r"[A-Za-z][a-z']*", lambda m: m.group(0).capitalize(), n.lower())
# A trailing qualifier that duplicates a place already present.
QUALIFIER = re.compile(
    r"\s+(north|south|east|west|town|city|bazar|bazaar|jetty|upper|lower|new|old|central)$",
    re.I,
)

def plausible_name(s: str) -> bool:
    """Latin letters, a sane length, not an airport code, not an institution."""
    s = strip_marks(s).strip()
    if len(s) < 3 or len(s) > 48:
        return False
    if not re.match(r"^[A-Za-z][A-Za-z0-9 .'\-/()]*$", s):
        return False
    # An all-caps short string is normally an airport or agency code, but a few
    # are what everyone actually calls the place.
    if re.fullmatch(r"[A-Z]{2,4}", s) and s.upper() not in SHORT_ALIASES:
        return False
    if INITIALISM.match(s):
        return False
    if JUNK.search(s):
        return False
    return True
