"""Stage 11: corrections from the November 2026 official-source audit.

Every correction is a recorded operation in corrections/*.json, with the reason
and the official source it rests on, so the data can be rebuilt and each change
traced back to evidence. Nothing here is a free-hand edit of the output file.

Every operation is idempotent: run twice, the second run changes nothing. That
is what lets this stage run against both a fresh build and data that already
carries some of the corrections.

Operations
  state_rename      {state, to}                       legal rename of a state
  district_rename   {state, district, to}             spelling/name change
  district_aliases  {state, district, add: [...]}     names people type
  move              {state, from, to, city}           refile under the right district
  rename            {state, district, city, to}       canonical spelling change
  merge             {state, district, keep, drop}     one place stored twice
  add_alias         {state, district, city, add: [...]}
  drop_alias        {state, district, city, alias}    alias that names another place
  add_town          {state, district, city, tier, aka, src}
  drop_town         {state, district, city}           not a place at all
  set_tier          {state, district, city, tier}

Renamed and moved rows keep their old spelling as an alias, so nobody who
types the name they know loses the row.
"""
import json, os, sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translit import canon, norm

HERE = Path(__file__).parent
DATA = HERE.parent / "data" / "india-places.json"
REG = HERE / "districts.json"
CORR = HERE / "corrections"
TS = [HERE.parent.parent / "src/modules/places/districtAliases.ts", HERE / "districtAliases.ts"]
RANK = {"corporation": 0, "municipality": 1, "cantonment": 2, "census town": 3, "locality": 4}


def key(name):
    return canon(name) or norm(name)


def find(rows, name):
    """The row for `name`, matched as verify.py's uniqueness check matches."""
    exact = [r for r in rows if r["city"].lower() == name.lower()]
    if exact:
        return exact[0]
    k = key(name)
    hits = [r for r in rows if key(r["city"]) == k]
    if len(hits) == 1:
        return hits[0]
    # A row renamed by an earlier operation keeps its old name as an alias, so
    # a later operation written against the old name still finds it.
    hits = [r for r in rows if any(norm(a) == norm(name) for a in r["aka"])]
    return hits[0] if len(hits) == 1 else None


def add_aka(row, names):
    have = {norm(a) for a in row["aka"]} | {norm(row["city"])}
    for a in names:
        if a and norm(a) not in have:
            row["aka"].append(a)
            have.add(norm(a))


def absorb(keep, drop):
    """Fold `drop` into `keep`: aliases, sources, the better tier."""
    add_aka(keep, drop["aka"] + [drop["city"]])
    for s in drop["src"]:
        if s not in keep["src"]:
            keep["src"].append(s)
    if RANK.get(drop["tier"], 9) < RANK.get(keep["tier"], 9):
        keep["tier"] = drop["tier"]


def scrub(rows):
    """An alias may not be its own row's name or another row's name."""
    names = {norm(r["city"]) for r in rows}
    for r in rows:
        r["aka"] = [a for a in r["aka"]
                    if norm(a) != norm(r["city"]) and norm(a) not in names]


class Run:
    def __init__(self):
        self.doc = json.loads(DATA.read_text(encoding="utf-8"))
        self.reg = json.loads(REG.read_text(encoding="utf-8"))
        self.P = self.doc["places"]
        self.done = self.already = 0
        self.problems = []
        self.state_to, self.district_to = {}, {}
        for f in sorted(CORR.glob("*.json")):
            for op in json.loads(f.read_text(encoding="utf-8"))["ops"]:
                if op["op"] == "state_rename":
                    self.state_to[op["state"]] = op["to"]
        for f in sorted(CORR.glob("*.json")):
            for op in json.loads(f.read_text(encoding="utf-8"))["ops"]:
                if op["op"] == "district_rename":
                    s = self.state_to.get(op["state"], op["state"])
                    self.district_to[(s, op["district"])] = op["to"]
                    self.district_to[(op["state"], op["district"])] = op["to"]

    def bad(self, op, why):
        self.problems.append(f"{op.get('op')}: {why} :: {json.dumps(op, ensure_ascii=False)}")

    # Operations are written against the names that were current when the
    # finding was made. After a rename, a re-run must still find its target,
    # or the stage stops being idempotent - so lookups follow renames.
    def where(self, s, d=None):
        s = s if s in self.P else self.state_to.get(s, s)
        if d is not None and d not in self.P.get(s, {}):
            d = self.district_to.get((s, d), d)
        return s, d

    def rows(self, s, d):
        s, d = self.where(s, d)
        return self.P.get(s, {}).get(d)

    def reg_district(self, s, d):
        s, d = self.where(s, d)
        return next((x for x in self.reg.get(s, {}).get("districts", []) if x["name"] == d), None)

    # ---- state / district ------------------------------------------------
    def state_rename(self, op):
        s, to = op["state"], op["to"]
        if to in self.P and s not in self.P:
            self.already += 1; return
        if s not in self.P:
            return self.bad(op, "state not found")
        self.P[to] = self.P.pop(s)
        self.reg[to] = self.reg.pop(s)
        self.done += 1

    def district_rename(self, op):
        s, d, to = op["state"], op["district"], op["to"]
        s, _ = self.where(s)
        st = self.P.get(s)
        if st is None:
            return self.bad(op, "state not found")
        if to in st and d not in st:
            self.already += 1; return
        if d not in st:
            return self.bad(op, "district not found")
        st[to] = st.pop(d)
        r = next(x for x in self.reg[s]["districts"] if x["name"] == d)
        r["name"] = to
        if not any(norm(a) == norm(d) for a in r["aliases"]):
            r["aliases"].append(d)
        r["aliases"] = [a for a in r["aliases"] if norm(a) != norm(to)]
        self.done += 1

    def district_aliases(self, op):
        r = self.reg_district(op["state"], op["district"])
        if r is None:
            return self.bad(op, "district not found")
        s, d = self.where(op["state"], op["district"])
        d = r["name"]
        others = {norm(x["name"]) for x in self.reg[s]["districts"] if x is not r}
        owner = {norm(a): x["name"] for x in self.reg[s]["districts"] if x is not r for a in x["aliases"]}
        added = False
        for a in op["add"]:
            n = norm(a)
            if n == norm(d) or any(norm(x) == n for x in r["aliases"]):
                continue
            if n in others or n in owner:
                self.bad({**op, "add": [a]}, f"'{a}' already names {owner.get(n, 'another district')}")
                continue
            r["aliases"].append(a); added = True
        if added: self.done += 1
        else: self.already += 1

    def district_drop_alias(self, op):
        r = self.reg_district(op["state"], op["district"])
        if r is None:
            return self.bad(op, "district not found")
        before = len(r["aliases"])
        r["aliases"] = [a for a in r["aliases"] if norm(a) != norm(op["alias"])]
        if len(r["aliases"]) < before: self.done += 1
        else: self.already += 1

    def district_note(self, op):
        s, _ = self.where(op["state"])
        if self.reg[s].get(op["field"]) == op["text"]:
            self.already += 1; return
        self.reg[s][op["field"]] = op["text"]; self.done += 1

    # ---- city layer -------------------------------------------------------
    def move(self, op):
        s, frm, to, c = op["state"], op["from"], op["to"], op["city"]
        src, dst = self.rows(s, frm), self.rows(s, to)
        if src is None or dst is None:
            return self.bad(op, "district not found")
        row = find(src, c)
        if row is None:
            if find(dst, c): self.already += 1; return
            return self.bad(op, "town not found in either district")
        src.remove(row)
        twin = find(dst, row["city"])
        if twin is None:
            dst.append(row)
        elif RANK.get(row["tier"], 9) < RANK.get(twin["tier"], 9):
            dst.remove(twin); absorb(row, twin); dst.append(row)
        else:
            absorb(twin, row)
        self.done += 1

    def rename(self, op):
        s, d, c, to = op["state"], op["district"], op["city"], op["to"]
        rows = self.rows(s, d)
        if rows is None:
            return self.bad(op, "district not found")
        row = next((r for r in rows if r["city"].lower() == c.lower()), None) or find(rows, c)
        if row is None or row["city"] == to:
            done = find(rows, to)
            if done:
                # Renamed before, or the source already used the new spelling.
                # Either way the name people know must still find the row:
                # "Rourkela" reached nothing because the census already said
                # "Raurkela", so the old name was never recorded.
                others = {norm(r["city"]) for r in rows if r is not done}
                if norm(c) not in others and not any(norm(a) == norm(c) for a in done["aka"]) and norm(c) != norm(done["city"]):
                    done["aka"].append(c); self.done += 1
                else:
                    self.already += 1
                return
            # renamed and then moved by a later operation: look state-wide
            st, _ = self.where(s)
            if any(r["city"] == to and any(norm(a) == norm(c) for a in r["aka"])
                   for rs in self.P[st].values() for r in rs):
                self.already += 1; return
            return self.bad(op, "town not found")
        clash = next((r for r in rows if r is not row and key(r["city"]) == key(to)), None)
        old = row["city"]
        row["city"] = to
        add_aka(row, [old])
        if clash:   # the new name already had a row: they are one place
            rows.remove(clash); absorb(row, clash)
        self.done += 1

    def merge(self, op):
        s, d = op["state"], op["district"]
        rows = self.rows(s, d) or []
        keep = next((r for r in rows if r["city"] == op["keep"]), None) or \
               next((r for r in rows if key(r["city"]) == key(op["keep"])), None)
        drop = next((r for r in rows if r["city"] == op["drop"] and r is not keep), None) or \
               next((r for r in rows if r is not keep and key(r["city"]) == key(op["drop"])), None)
        if drop is None:
            # "Already merged" needs evidence: the dropped name survives as an
            # alias of the kept row - here, or wherever a later operation
            # moved it. Anything else is a merge that never happened, and
            # treating that as done once left three duplicates in place.
            st, _ = self.where(s)
            merged = any(norm(a) == norm(op["drop"]) for rs in self.P[st].values() for r in rs
                         if key(r["city"]) == key(op["keep"]) for a in r["aka"])
            if merged: self.already += 1; return
            return self.bad(op, "drop row not found and no sign it was ever merged")
        if keep is None:
            return self.bad(op, "keep row not found")
        rows.remove(drop); absorb(keep, drop); self.done += 1

    def add_alias(self, op):
        rows = self.rows(op["state"], op["district"])
        row = find(rows, op["city"]) if rows else None
        if row is None:
            return self.bad(op, "town not found")
        others = {norm(r["city"]) for r in rows if r is not row}
        clash = [a for a in op["add"] if norm(a) in others]
        if clash:
            self.bad(op, f"would name another town: {clash}")
        before = len(row["aka"])
        add_aka(row, [a for a in op["add"] if norm(a) not in others])
        if len(row["aka"]) > before: self.done += 1
        else: self.already += 1

    def drop_alias(self, op):
        rows = self.rows(op["state"], op["district"])
        row = find(rows, op["city"]) if rows else None
        if row is None:
            return self.bad(op, "town not found")
        before = len(row["aka"])
        # Exact string, not the folded form: the folding ignores digits, so a
        # fuzzy match removing "Rourkela 10" would also remove "Rourkela".
        row["aka"] = [a for a in row["aka"] if a.strip().lower() != op["alias"].strip().lower()]
        if len(row["aka"]) < before: self.done += 1
        else: self.already += 1

    def add_town(self, op):
        rows = self.rows(op["state"], op["district"])
        if rows is None:
            return self.bad(op, "district not found")
        hit = find(rows, op["city"])
        if hit:
            # The register's own spelling is the official one: an existing row
            # under another spelling (Munsiari for Munsyari) takes it, and keeps
            # its old spelling as an alias.
            changed = False
            if hit["city"].lower() != op["city"].lower() and key(hit["city"]) == key(op["city"]):
                old = hit["city"]; hit["city"] = op["city"]; add_aka(hit, [old]); changed = True
            for sr in op["src"]:          # the register now attests this row too
                if sr not in hit["src"]: hit["src"].append(sr); changed = True
            if changed: self.done += 1
            else: self.already += 1
            return
        rows.append({"city": op["city"], "tier": op["tier"],
                     "aka": list(op.get("aka", [])), "src": list(op["src"])})
        self.done += 1

    def drop_town(self, op):
        rows = self.rows(op["state"], op["district"])
        row = next((r for r in rows if r["city"] == op["city"]), None) if rows else None
        if row is None:
            self.already += 1; return
        rows.remove(row); self.done += 1

    def set_tier(self, op):
        rows = self.rows(op["state"], op["district"])
        row = find(rows, op["city"]) if rows else None
        if row is None:
            return self.bad(op, "town not found")
        # A town tier is a claim about a municipal body or a census town; record
        # what attests it, or the row would assert a tier its sources never made.
        evidence = {"census town": "census"}.get(op["tier"], "state-ulb-register") \
            if op["tier"] != "locality" else None
        need = evidence and not ({"census", "state-ulb-register"} & set(row["src"]))
        if row["tier"] == op["tier"] and not need:
            self.already += 1; return
        row["tier"] = op["tier"]
        if need: row["src"].append(evidence)
        self.done += 1

    # ---- outputs ----------------------------------------------------------
    def write(self):
        for s, ds in self.P.items():
            for d, rows in ds.items():
                scrub(rows)
                rows.sort(key=lambda r: r["city"])
        # An alias that differs from its district only by spacing or punctuation
        # ("Yamuna Nagar") adds nothing: the search compares with those ignored.
        for v in self.reg.values():
            for x in v["districts"]:
                seen, keep = {norm(x["name"])}, []
                for a in x["aliases"]:
                    if norm(a) not in seen:
                        seen.add(norm(a)); keep.append(a)
                x["aliases"] = keep
        # One source of truth for district names and aliases: districts.json.
        # The data file's copy and both .ts copies are derived from it.
        self.doc["places"] = {s: self.P[s] for s in sorted(self.P)}
        self.doc["districts"] = {
            s: [{"name": x["name"], "aliases": sorted(set(x["aliases"]))}
                for x in sorted(v["districts"], key=lambda x: x["name"])]
            for s, v in sorted(self.reg.items())}
        self.reg = {s: self.reg[s] for s in sorted(self.reg)}
        DATA.write_text(json.dumps(self.doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        REG.write_text(json.dumps(self.reg, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        lines = ["// GENERATED FILE - do not edit by hand.",
                 "// Source: prisma/places-build/districts.json, written by apply_corrections.py.",
                 "//",
                 "// An alias is a former official name, a dissolved predecessor district, an",
                 "// alternate romanisation, or the district's headquarters town - people write",
                 "// the HQ town where a district is asked for. An alias two districts of the",
                 "// same state could claim is never added; districts.json records why.",
                 "",
                 "export const DISTRICT_ALIASES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {"]
        for s, v in self.reg.items():
            rows = sorted((x["name"], sorted(set(x["aliases"]))) for x in v["districts"] if x["aliases"])
            if not rows: continue
            lines.append(f"  {json.dumps(s, ensure_ascii=False)}: {{")
            for n, al in rows:
                lines.append(f"    {json.dumps(n, ensure_ascii=False)}: [{', '.join(json.dumps(a, ensure_ascii=False) for a in al)}],")
            lines.append("  },")
        lines += ["};", "",
                  "export const districtAliasesFor = (state: string, district: string): readonly string[] =>",
                  "  DISTRICT_ALIASES[state]?.[district] ?? [];", "",
                  "// Every verified district, including those no town is filed under yet.",
                  "// The District field lists from this, not from the places table: a",
                  "// district created after India Post compiled its data (Sakti, Vav-Tharad,",
                  "// Bichom...) holds no rows, and would otherwise be impossible to pick.",
                  "export const DISTRICTS: Readonly<Record<string, readonly string[]>> = {"]
        for s, v in self.reg.items():
            names = ", ".join(json.dumps(x["name"], ensure_ascii=False) for x in sorted(v["districts"], key=lambda x: x["name"]))
            lines.append(f"  {json.dumps(s, ensure_ascii=False)}: [{names}],")
        lines += ["};", "",
                  "export const districtsOf = (state: string): readonly string[] => DISTRICTS[state] ?? [];", ""]
        for p in TS:
            p.write_text("\n".join(lines), encoding="utf-8")


def remap_rules(files):
    """What a stored address must become, for every change that renames it.

    Listings and projects store state, district and city as plain strings, so a
    rename in `places` leaves existing rows pointing at a name the type-ahead
    no longer offers. The rules are in operation order, and each one names the
    place as it was when that operation was written - so applied in order, a
    town that was moved and then renamed is carried through both steps.
    """
    rules = []
    for f in files:
        for op in json.loads(f.read_text(encoding="utf-8"))["ops"]:
            k = op["op"]
            if k == "state_rename":
                rules.append({"match": {"state": op["state"]}, "set": {"state": op["to"]}})
            elif k == "district_rename":
                rules.append({"match": {"state": op["state"], "district": op["district"]},
                              "set": {"district": op["to"]}})
            elif k == "move":
                rules.append({"match": {"state": op["state"], "district": op["from"], "city": op["city"]},
                              "set": {"district": op["to"]}})
            elif k == "rename":
                rules.append({"match": {"state": op["state"], "district": op["district"], "city": op["city"]},
                              "set": {"city": op["to"]}})
            elif k == "merge":
                rules.append({"match": {"state": op["state"], "district": op["district"], "city": op["drop"]},
                              "set": {"city": op["keep"]}})
    return rules


def main():
    run = Run()
    files = sorted(CORR.glob("*.json"))
    for f in files:
        spec = json.loads(f.read_text(encoding="utf-8"))
        for op in spec["ops"]:
            getattr(run, op["op"])(op)
    run.write()
    rules = remap_rules(files)
    (DATA.parent / "place-remap.json").write_text(
        json.dumps({"why": remap_rules.__doc__.strip(), "rules": rules}, indent=1, ensure_ascii=False) + "\n",
        encoding="utf-8")
    print(f"  remap: {len(rules)} rules -> data/place-remap.json")
    print(f"  corrections: {len(files)} files, {run.done} applied, {run.already} already in place, "
          f"{len(run.problems)} problems")
    for p in run.problems:
        print("   PROBLEM", p)
    sys.exit(1 if run.problems else 0)


if __name__ == "__main__":
    main()
