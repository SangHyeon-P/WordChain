#!/usr/bin/env python3
from pathlib import Path
import zipfile,json,re,unicodedata,argparse
HANGUL_RE=re.compile(r"^[가-힣]+$"); CLEAN_RE=re.compile(r"[-‐‑‒–—―·ㆍ^\s]"); TRAIL_NUM_RE=re.compile(r"[0-9０-９]+$")
def norm(raw):
    s=unicodedata.normalize("NFC",str(raw or "")).strip(); s=CLEAN_RE.sub("",s); return TRAIL_NUM_RE.sub("",s)
def shard(word,n=64):
    h=0
    for ch in word: h=((h*31)+ord(ch))&0xffffffff
    return h%n
p=argparse.ArgumentParser(description="우리말샘 ZIP에서 현재 게임 단어의 뜻풀이 DB를 재생성합니다.")
p.add_argument("source_zip"); p.add_argument("--db",default="db"); a=p.parse_args()
db=Path(a.db); words_path=db/"words.txt"; defs_dir=db/"definitions"; defs_dir.mkdir(parents=True,exist_ok=True)
words={norm(x) for x in words_path.read_text("utf-8").splitlines() if len(norm(x))>=2 and HANGUL_RE.fullmatch(norm(x))}
defs={}
with zipfile.ZipFile(a.source_zip) as z:
    for info in z.infolist():
        with z.open(info) as f: data=json.load(f)
        for it in data.get("channel",{}).get("item",[]) or []:
            w=norm((it.get("wordinfo") or {}).get("word"))
            if w not in words: continue
            d=(it.get("senseinfo") or {}).get("definition")
            if not isinstance(d,str): continue
            d=" ".join(d.split())
            if d and d not in defs.setdefault(w,[]): defs[w].append(d)
shards=[{} for _ in range(64)]
for w in sorted(defs): shards[shard(w)][w]=defs[w]
for i,obj in enumerate(shards): (defs_dir/f"{i:03d}.json").write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")),"utf-8")
print(f"완료: 단어 {len(words):,}개 / 뜻풀이 있는 단어 {len(defs):,}개")
