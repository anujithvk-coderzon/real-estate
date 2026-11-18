#!/bin/bash
# The order matters and was wrong once: folding fragments creates new rows
# ("Gurgaon" out of "Gurgaon Sector 4"), so it has to run BEFORE the rename
# and alias passes, or the new rows never get renamed or aliased.
set -e
cd "$(dirname "$0")"   # sources are expected in ../post ../geonames ../altnames ../census
echo "1/11 census ..."    && python3 -I census_parse.py  >/dev/null
echo "2/11 build ..."     && python3 -I build.py         >/dev/null
echo "3/11 finalize ..."  && python3 -I finalize.py      >/dev/null
echo "4/11 fragments ..." && python3 -I fragments.py     >/dev/null
echo "5/11 citynames ..." && python3 -I citynames.py     >/dev/null
echo "6/11 audit r1 ..."  && python3 -I audit_apply.py   >/dev/null
echo "7/11 audit r2 ..."  && python3 -I audit2_apply.py  >/dev/null
echo "8/11 compounds ..."  && python3 -I compounds.py     >/dev/null
echo "9/11 audit r3 ..." && python3 -I audit3_apply.py  >/dev/null
echo "10/11 ascii ..."   && python3 -I ascii_fold.py    >/dev/null
# 11 is last on purpose: its corrections name places as the audit found them,
# and the renames in corrections/99_official_names.json must come after them.
echo "11/11 corrections ..." && python3 -I apply_corrections.py
python3 -I -c "
import json
d=json.load(open("../data/india-places.json",encoding="utf-8"))
P=d['places']
n=sum(len(r) for v in P.values() for r in v.values())
a=sum(len(x['aka']) for v in P.values() for r in v.values() for x in r)
print(f'  states {len(P)}  districts {sum(len(v) for v in P.values())}  places {n}  aliases {a}')
"
