"""Apply verified city-layer corrections to data/india-places.json.

Four operations, each checked before it is applied:
  drop_alias   - remove an alias that names a different place
  add_alias    - add an attested alternate name
  rename       - change a canonical spelling, keeping the old one as an alias
  move         - refile a town under the district it is actually in
  add_town     - insert a town that was missing entirely

Nothing is applied blind: a drop whose alias is not present, a move whose
target district does not exist, or a rename that would collide with an
existing row in the same district is REPORTED and skipped, never forced.
"""
import json, re, sys
from pathlib import Path

DATA = Path(__file__).parent.parent / "data/india-places.json"

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())

def run(ops):
    doc = json.loads(DATA.read_text(encoding="utf-8"))
    P = doc["places"]
    done, skipped = [], []

    def find(state, dist, city):
        for p in P.get(state, {}).get(dist, []):
            if norm(p["city"]) == norm(city):
                return p
        return None

    for op in ops.get("drop_alias", []):
        st, di, ci, al = op
        p = find(st, di, ci)
        if not p: skipped.append(("drop_alias", op, "town not found")); continue
        before = len(p.get("aka", []))
        p["aka"] = [a for a in p.get("aka", []) if norm(a) != norm(al)]
        (done if len(p["aka"]) < before else skipped).append(
            ("drop_alias", op, "ok" if len(p["aka"]) < before else "alias not present"))

    for op in ops.get("add_alias", []):
        st, di, ci, al = op
        p = find(st, di, ci)
        if not p: skipped.append(("add_alias", op, "town not found")); continue
        # an alias must not name a different town in the same district
        clash = [q["city"] for q in P[st][di] if q is not p and norm(q["city"]) == norm(al)]
        if clash: skipped.append(("add_alias", op, f"names another town: {clash}")); continue
        if any(norm(a) == norm(al) for a in p.get("aka", [])):
            skipped.append(("add_alias", op, "already present")); continue
        p.setdefault("aka", []).append(al); done.append(("add_alias", op, "ok"))

    for op in ops.get("rename", []):
        st, di, old, new = op
        p = find(st, di, old)
        if not p: skipped.append(("rename", op, "town not found")); continue
        if any(norm(q["city"]) == norm(new) for q in P[st][di] if q is not p):
            skipped.append(("rename", op, "target name already a row in this district")); continue
        p.setdefault("aka", [])
        if norm(old) != norm(new) and not any(norm(a) == norm(old) for a in p["aka"]):
            p["aka"].append(p["city"])
        p["city"] = new; done.append(("rename", op, "ok"))

    for op in ops.get("move", []):
        st, frm, to, ci = op
        p = find(st, frm, ci)
        if not p: skipped.append(("move", op, "town not found in source district")); continue
        if to not in P.get(st, {}): skipped.append(("move", op, "target district missing")); continue
        if any(norm(q["city"]) == norm(ci) for q in P[st][to]):
            skipped.append(("move", op, "already a row in target district")); continue
        P[st][frm].remove(p); P[st][to].append(p); done.append(("move", op, "ok"))

    for op in ops.get("add_town", []):
        st, di, ci, tier, aka, src = op
        if st not in P or di not in P[st]: skipped.append(("add_town", op, "district missing")); continue
        if find(st, di, ci): skipped.append(("add_town", op, "already present")); continue
        P[st][di].append({"city": ci, "tier": tier, "aka": aka, "src": src})
        done.append(("add_town", op, "ok"))

    for op in ops.get("drop_town", []):
        st, di, ci = op
        p = find(st, di, ci)
        if not p: skipped.append(("drop_town", op, "not found")); continue
        P[st][di].remove(p); done.append(("drop_town", op, "ok"))

    for st in P:
        for di in P[st]:
            P[st][di].sort(key=lambda x: x["city"])
    DATA.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return done, skipped

if __name__ == "__main__":
    done, skipped = run(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    print(f"applied {len(done)}")
    for d in done: print("   OK  ", d[0], d[1])
    print(f"skipped {len(skipped)}")
    for s in skipped: print("   SKIP", s[0], s[1], "->", s[2])
