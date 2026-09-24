import math, sys, urllib.parse
sys.path.insert(0,'.')
from donkey import NECK,SKULL,BRIDGE,MUZ,EAR_L,EAR_R,EAR_L_IN,EAR_R_IN,MANE,EYE,NOSTRIL,MOUTH,CREAM_CAP

def ell(e):
    cx,cy,rx,ry,rot=e
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})"/>'
def poly(pts):
    return "M"+" L".join(f"{x:.2f} {y:.2f}" for x,y in pts)+" Z"

GOLD='url(#dkGold)'; INK='#2E382C'; CREAM='#F7F4ED'

donkey_body = (
  f'<g fill="{GOLD}">'+ell(NECK)+ell(EAR_L)+ell(EAR_R)+'</g>'
  f'<g fill="{INK}" opacity=".92">'+ell(EAR_L_IN)+ell(EAR_R_IN)+'</g>'
  f'<g fill="{GOLD}">'+ell(SKULL)+ell(BRIDGE)+ell(MUZ)+'</g>'
  f'<path d="{poly(MANE)}" fill="{INK}" opacity=".92"/>'
  f'<circle cx="{EYE[0]}" cy="{EYE[1]}" r="1.8" fill="{INK}"/>'
  f'<g clip-path="url(#dkMuzzle)"><circle cx="{CREAM_CAP[0]}" cy="{CREAM_CAP[1]}" r="{CREAM_CAP[2]}" fill="{CREAM}"/></g>'
  f'<circle cx="{NOSTRIL[0]}" cy="{NOSTRIL[1]}" r="{NOSTRIL[2]}" fill="{INK}"/>'
  f'<path d="M{MOUTH[0][0]} {MOUTH[0][1]} L{MOUTH[1][0]} {MOUTH[1][1]}" stroke="{INK}" stroke-width="1.05" stroke-linecap="round" fill="none"/>'
)

sprite = f'''<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="dkGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9D9B4"/><stop offset=".55" stop-color="#C8A96B"/><stop offset="1" stop-color="#A5813C"/></linearGradient>
    <linearGradient id="dkSage" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DB096"/><stop offset="1" stop-color="#6E8169"/></linearGradient>
    <clipPath id="dkMuzzle">{ell(MUZ)}</clipPath>
    <symbol id="donkey" viewBox="0 0 64 64">{donkey_body}</symbol>
    <symbol id="donkey-badge" viewBox="0 0 64 64">
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#dkSage)"/>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="none" stroke="#C8A96B" stroke-width="2.4"/>
      <rect x="7" y="7" width="50" height="50" rx="11" fill="none" stroke="{CREAM}" stroke-opacity=".35" stroke-width="1"/>
      <use href="#donkey"/>
    </symbol>
  </defs>
</svg>'''
open('sprite.html','w').write(sprite)

# compact standalone badge for the favicon (flat colours, no <use>)
fav = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  '<rect x="2" y="2" width="60" height="60" rx="15" fill="#7E9179"/>'
  '<rect x="2" y="2" width="60" height="60" rx="15" fill="none" stroke="#C8A96B" stroke-width="3"/>'
  f'<g fill="#C8A96B">{ell(NECK)}{ell(EAR_L)}{ell(EAR_R)}</g>'
  f'<g fill="#2E382C">{ell(EAR_L_IN)}{ell(EAR_R_IN)}</g>'
  f'<g fill="#C8A96B">{ell(SKULL)}{ell(BRIDGE)}{ell(MUZ)}</g>'
  f'<path d="{poly(MANE)}" fill="#2E382C"/>'
  f'<circle cx="{EYE[0]}" cy="{EYE[1]}" r="1.8" fill="#2E382C"/>'
  f'<g clip-path="url(#m)"><circle cx="{CREAM_CAP[0]}" cy="{CREAM_CAP[1]}" r="{CREAM_CAP[2]}" fill="#F7F4ED"/></g>'
  f'<clipPath id="m">{ell(MUZ)}</clipPath>'
  f'<circle cx="{NOSTRIL[0]}" cy="{NOSTRIL[1]}" r="{NOSTRIL[2]}" fill="#2E382C"/></svg>')
enc=urllib.parse.quote(fav, safe=":/='\"<>,.-_#%;&()")
open('favicon.txt','w').write('data:image/svg+xml,'+enc)
print('sprite bytes:', len(sprite), '| favicon bytes:', len(enc)+19)
