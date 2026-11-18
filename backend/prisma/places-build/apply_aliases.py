"""Add district aliases to districts.json and regenerate districtAliases.ts.

districts.json is the source of truth; the .ts is its transcription. Editing
only one of them is how they drift, so this does both or neither.

Every addition is checked first: an alias may not name another district of the
same state, and may not already be claimed by a different district. A rejected
alias is reported, never silently dropped.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).parent
DJ = HERE / "districts.json"
TS_OUT = [HERE.parent.parent / "src/modules/places/districtAliases.ts",
          HERE / "districtAliases.ts"]

HEADER = """// GENERATED FILE - do not edit by hand.
// Edit prisma/places-build/districts.json and re-run apply_aliases.py.
//
// District aliases, verified per state against government portals and gazette
// notifications, then corrected by independent regional audits.
//
// An alias here is one of: a former official name, a dissolved predecessor
// district, an alternate romanisation, or the district's headquarters town -
// people routinely write the HQ town where a district is asked for ("Mangalore"
// for Dakshina Kannada, "Shillong" for East Khasi Hills).
//
// An alias is NEVER added when two districts of the same state could claim it.
// Those are listed in districts.json's per-state notes instead, so the reason
// for leaving them out is not lost.

"""

def load():
    return json.loads(DJ.read_text(encoding="utf-8"))

def district(dj, state, name):
    for d in dj[state]["districts"]:
        if d["name"] == name:
            return d
    raise KeyError(f"{state} / {name}")

def add(dj, additions):
    """additions: {state: {district: [alias, ...]}}"""
    applied, rejected = [], []
    for state, per in additions.items():
        if state not in dj:
            rejected.append((state, "-", "-", "state not in districts.json")); continue
        canon = {d["name"].lower() for d in dj[state]["districts"]}
        owner = {}
        for d in dj[state]["districts"]:
            for a in d.get("aliases", []):
                owner[a.lower()] = d["name"]
        for name, aliases in per.items():
            try:
                tgt = district(dj, state, name)
            except KeyError:
                rejected.append((state, name, "-", "district not found")); continue
            for a in aliases:
                k = a.lower()
                if k in canon and k != name.lower():
                    rejected.append((state, name, a, "names a DIFFERENT district")); continue
                if k in owner and owner[k] != name:
                    rejected.append((state, name, a, f"already an alias of {owner[k]}")); continue
                if k == name.lower():
                    rejected.append((state, name, a, "same as canonical")); continue
                if any(x.lower() == k for x in tgt.get("aliases", [])):
                    rejected.append((state, name, a, "already present")); continue
                tgt.setdefault("aliases", []).append(a)
                owner[k] = name
                applied.append((state, name, a))
    return applied, rejected

def write(dj):
    DJ.write_text(json.dumps(dj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    out = [HEADER,
           "export const DISTRICT_ALIASES: Readonly<Record<string, "
           "Readonly<Record<string, readonly string[]>>>> = {\n"]
    for state in sorted(dj):
        rows = [(d["name"], sorted(set(d.get("aliases", []))))
                for d in dj[state]["districts"] if d.get("aliases")]
        if not rows:
            continue
        out.append(f'  {json.dumps(state)}: {{\n')
        for name, al in sorted(rows):
            out.append(f'    {json.dumps(name)}: [{", ".join(json.dumps(a) for a in al)}],\n')
        out.append("  },\n")
    out.append("};\n\nexport const districtAliasesFor = (\n  state: string,\n  district: string,\n"
               "): readonly string[] => DISTRICT_ALIASES[state]?.[district] ?? [];\n")
    for p in TS_OUT:
        p.write_text("".join(out), encoding="utf-8")

if __name__ == "__main__":
    dj = load()
    adds = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    applied, rejected = add(dj, adds)
    write(dj)
    print(f"applied {len(applied)} aliases")
    print(f"rejected {len(rejected)}")
    for r in rejected:
        print("   REJECTED", r)
