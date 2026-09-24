import sys, urllib.parse
sys.path.insert(0, '.')
from donkey import NECK, SKULL, BRIDGE, MUZ, EAR_L, EAR_R, EAR_L_IN, EAR_R_IN, MANE, EYE, NOSTRIL, CREAM_CAP

def ell(e):
    cx, cy, rx, ry, rot = e
    return '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" transform="rotate(%s %s %s)"/>' % (cx, cy, rx, ry, rot, cx, cy)

def poly(pts):
    return "M" + " L".join("%.2f %.2f" % (x, y) for x, y in pts) + " Z"

parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<defs><clipPath id="m">' + ell(MUZ) + '</clipPath></defs>',
    '<rect x="2" y="2" width="60" height="60" rx="15" fill="#0E211A"/>',
    '<rect x="2" y="2" width="60" height="60" rx="15" fill="none" stroke="#FFE25C" stroke-width="3"/>',
    '<g fill="#FFE25C">' + ell(NECK) + ell(EAR_L) + ell(EAR_R) + '</g>',
    '<g fill="#0B0F0D">' + ell(EAR_L_IN) + ell(EAR_R_IN) + '</g>',
    '<g fill="#FFE25C">' + ell(SKULL) + ell(BRIDGE) + ell(MUZ) + '</g>',
    '<path d="' + poly(MANE) + '" fill="#0B0F0D"/>',
    '<circle cx="%s" cy="%s" r="1.8" fill="#0B0F0D"/>' % (EYE[0], EYE[1]),
    '<g clip-path="url(#m)"><circle cx="%s" cy="%s" r="%s" fill="#F6F3EA"/></g>' % (CREAM_CAP[0], CREAM_CAP[1], CREAM_CAP[2]),
    '<circle cx="%s" cy="%s" r="%s" fill="#0B0F0D"/></svg>' % (NOSTRIL[0], NOSTRIL[1], NOSTRIL[2]),
]
fav = "".join(parts)
enc = "data:image/svg+xml," + urllib.parse.quote(fav, safe="")
raw = enc.split(",", 1)[1]
assert "#" not in raw and '"' not in raw and " " not in raw and "<" not in raw, "must be fully escaped"
open("favicon.txt", "w").write(enc)
print("favicon bytes:", len(enc))
