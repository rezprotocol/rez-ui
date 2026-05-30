#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import sys

src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("assets/doc-icon/master/rez-doc-icon-master-1024.png")
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets/doc-icon")

doc = Image.open(src).convert("RGBA")

# mac iconset
iconset = out/"mac/iconset"
iconset.mkdir(parents=True, exist_ok=True)
for s in [16,32,128,256,512]:
    doc.resize((s,s), Image.LANCZOS).save(iconset/f"icon_{s}x{s}.png")
    doc.resize((s*2,s*2), Image.LANCZOS).save(iconset/f"icon_{s}x{s}@2x.png")

# mac icns
(out/"mac").mkdir(parents=True, exist_ok=True)
doc.save(out/"mac/rez-doc-icon.icns", sizes=[(16,16),(32,32),(128,128),(256,256),(512,512),(1024,1024)])

# linux pngs
(out/"linux").mkdir(parents=True, exist_ok=True)
for s in [16,32,48,64,128,256,512,1024]:
    doc.resize((s,s), Image.LANCZOS).save(out/"linux"/f"rez-doc-icon-{s}x{s}.png")

# windows ico
(out/"win").mkdir(parents=True, exist_ok=True)
doc.save(out/"win/rez-doc-icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

print("Done.")
