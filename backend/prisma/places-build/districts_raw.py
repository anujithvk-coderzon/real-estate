import csv, collections, json, re, sys, unicodedata
sys.path.insert(0,"."); from states import canonical_state

def plain(s):
    s="".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))
    return " ".join(s.split())

# strip the decorations each source adds
SUFFIX=re.compile(r"\s*\b(district|dist|distt|zila|zilla|division)\b\.?\s*$", re.I)
def tidy_district(s):
    s=plain(s)
    s=SUFFIX.sub("", s).strip(" .,-")
    s=re.sub(r"\s+"," ",s)
    return s.title() if s and s.isupper() else s

po=collections.defaultdict(collections.Counter)
for r in csv.DictReader(open("../post/pincodes.csv",encoding="utf-8",errors="replace")):
    st=canonical_state(r.get("StateName") or "")
    d=tidy_district(r.get("District") or "")
    if st and d: po[st][d]+=1

a1={}; a2={}
for line in open("../geonames/admin1Codes.txt",encoding="utf-8"):
    p=line.rstrip("\n").split("\t")
    if len(p)>=2 and p[0].startswith("IN."): a1[p[0].split(".")[1]]=p[1]
for line in open("../geonames/admin2Codes.txt",encoding="utf-8"):
    p=line.rstrip("\n").split("\t")
    if len(p)>=2 and p[0].startswith("IN."):
        bits=p[0].split(".")
        if len(bits)>=3: a2[(bits[1],bits[2])]=p[1]

gn=collections.defaultdict(collections.Counter)
for r in csv.reader(open("../geonames/IN.txt",encoding="utf-8",newline=""),delimiter="\t",quoting=csv.QUOTE_NONE):
    if len(r)<15 or r[8]!="IN" or r[6]!="P": continue
    st=canonical_state(a1.get(r[10],""))
    d=tidy_district(a2.get((r[10],r[11]),""))
    if st and d: gn[st][d]+=1

print(f"{'state':<42}{'post':>6}{'geo':>6}")
tot_po=tot_gn=0
for st in sorted(set(po)|set(gn)):
    tot_po+=len(po[st]); tot_gn+=len(gn[st])
    print(f"  {st:<40}{len(po[st]):>6}{len(gn[st]):>6}")
print(f"  {'TOTAL':<40}{tot_po:>6}{tot_gn:>6}")
json.dump({"post":{k:dict(v) for k,v in po.items()},
           "geonames":{k:dict(v) for k,v in gn.items()}},
          open("districts_raw.json","w",encoding="utf-8"),ensure_ascii=False)
