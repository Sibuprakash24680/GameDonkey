import math
from PIL import Image, ImageDraw
S=8
def rot_pt(cx,cy,x,y,deg):
    a=math.radians(deg)
    return (cx+x*math.cos(a)-y*math.sin(a), cy+x*math.sin(a)+y*math.cos(a))
def rot_ellipse(cx,cy,rx,ry,deg,n=180):
    return [rot_pt(cx,cy,rx*math.cos(2*math.pi*i/n),ry*math.sin(2*math.pi*i/n),deg) for i in range(n)]

# ---- canonical geometry (64x64, facing left) ----
MUZ=(20.5,43.5,9.4,6.4,-18)
NECK=(42.5,45.5,7.8,9.2,6)
SKULL=(35,34,10.6,12.6,15)
BRIDGE=(27.5,37.5,5.2,4.6,-12)
EAR_L=(28.0,17.0,3.6,8.6,-26)      # (cx,cy,rx,ry,rot) rounded-tip ellipse, splayed out
EAR_R=(37.0,16.0,3.6,8.6,26)
EAR_L_IN=(28.2,17.6,1.7,5.2,-26)
EAR_R_IN=(36.8,16.6,1.7,5.2,26)
def shrink(poly,f,dy=0.0):
    cx=sum(p[0] for p in poly)/len(poly); cy=sum(p[1] for p in poly)/len(poly)
    return [(cx+(x-cx)*f, cy+(y-cy)*f+dy) for x,y in poly]
def mane_crescent():
    cx,cy,rx,ry,rot=NECK; N=25; outer=[]
    for i in range(N):
        u=i/(N-1); t=math.radians(-72+(112*u))
        off=1.6*math.sin(math.pi*u)              # taper to nothing at both ends
        outer.append(rot_pt(cx,cy,(rx+off)*math.cos(t),(ry+off)*math.sin(t),rot))
    inner=[]
    for i in range(N-1,-1,-1):
        u=i/(N-1); t=math.radians(-72+(112*u))
        inner.append(rot_pt(cx,cy,(rx-1.4)*math.cos(t),(ry-1.4)*math.sin(t),rot))
    return outer+inner
MANE=mane_crescent()
EYE=(29.9,32.1,1.6); NOSTRIL=(14.4,44.6,1.15); MOUTH=[(12.4,47.8),(16.8,48.8)]
CREAM_CAP=(13.4,45.6,4.4)

def donkey(d, fill, dark, ox=0, oy=0, s=1.0, cream=None, clipmuzzle=None):
    def P(x,y): return ((x*s+ox)*S,(y*s+oy)*S)
    def E(*e): return [P(*p) for p in rot_ellipse(*e)]
    def Q(poly): return [P(*p) for p in poly]
    d.polygon(E(*NECK), fill=fill)
    d.polygon(E(*EAR_L), fill=fill); d.polygon(E(*EAR_R), fill=fill)    # ears behind the skull
    d.polygon(E(*EAR_L_IN), fill=dark); d.polygon(E(*EAR_R_IN), fill=dark)
    d.polygon(E(*SKULL), fill=fill)
    d.polygon(E(*BRIDGE), fill=fill)
    d.polygon(E(*MUZ), fill=fill)
    d.polygon(Q(MANE), fill=dark)
    d.ellipse([P(EYE[0]-EYE[2],EYE[1]-EYE[2]),P(EYE[0]+EYE[2],EYE[1]+EYE[2])], fill=dark)
    if cream and clipmuzzle is not None:
        cm=Image.new('RGBA',(64*S,64*S),(0,0,0,0)); ImageDraw.Draw(cm).ellipse([P(CREAM_CAP[0]-CREAM_CAP[2],CREAM_CAP[1]-CREAM_CAP[2]),P(CREAM_CAP[0]+CREAM_CAP[2],CREAM_CAP[1]+CREAM_CAP[2])],fill=cream)
        mz=Image.new('L',(64*S,64*S),0); ImageDraw.Draw(mz).polygon(E(*MUZ),fill=255)
        cm.putalpha(Image.composite(cm.getchannel('A'),Image.new('L',cm.size,0),mz))
        clipmuzzle.paste(cm,(0,0),cm.getchannel('A'))
    d.ellipse([P(NOSTRIL[0]-NOSTRIL[2],NOSTRIL[1]-NOSTRIL[2]),P(NOSTRIL[0]+NOSTRIL[2],NOSTRIL[1]+NOSTRIL[2])], fill=dark)
    d.line([P(*MOUTH[0]),P(*MOUTH[1])], fill=dark, width=int(1.0*S))

# ---------- SVG emission from the SAME numbers ----------
def svg_paths(fmt):
    def poly(pts): return "M" + " L".join(f"{x:.2f} {y:.2f}" for x,y in pts) + " Z"
    out=[]
    return [NECK, EAR_L, EAR_R, SKULL, BRIDGE, MUZ]

def badge(size_px):
    W=64*S
    img=Image.new('RGBA',(W,W),(0,0,0,0))
    SAGE_HI=(23,53,42); SAGE_LO=(8,21,16); GOLD=(255,226,92)
    grad=Image.new('RGBA',(W,W),(0,0,0,0)); gd=ImageDraw.Draw(grad)
    for y in range(W):
        t=y/W; gd.line([(0,y),(W,y)],fill=tuple(int(SAGE_HI[i]+(SAGE_LO[i]-SAGE_HI[i])*t) for i in range(3))+(255,))
    mask=Image.new('L',(W,W),0); ImageDraw.Draw(mask).rounded_rectangle([2*S,2*S,W-2*S,W-2*S],radius=15*S,fill=255)
    img.paste(grad,(0,0),mask); d=ImageDraw.Draw(img)
    d.rounded_rectangle([2*S,2*S,W-2*S,W-2*S],radius=15*S,outline=GOLD,width=2*S)
    d.rounded_rectangle([7*S,7*S,W-7*S,W-7*S],radius=11*S,outline=(255,226,92,70),width=S)
    dk=Image.new('RGBA',(W,W),(0,0,0,0)); donkey(ImageDraw.Draw(dk),(255,240,161,255),(11,15,13,255))
    gm=Image.new('L',(W,W),0); donkey(ImageDraw.Draw(gm),255,0)
    gimg=Image.new('RGBA',(W,W),(0,0,0,0))
    for y in range(W):
        t=y/W; ImageDraw.Draw(gimg).line([(0,y),(W,y)],fill=(int(255+(217-255)*t),int(240+(169-240)*t),int(161+(40-161)*t),255))
    img.paste(gimg,(0,0),gm)
    creamL=Image.new('RGBA',(W,W),(0,0,0,0))
    donkey(ImageDraw.Draw(Image.new('RGBA',(W,W),(0,0,0,0))),(0,0,0,0),(0,0,0,0),cream=(246,243,234,255),clipmuzzle=creamL)
    img=Image.alpha_composite(img,creamL)
    det=Image.new('RGBA',(W,W),(0,0,0,0)); donkey(ImageDraw.Draw(det),(0,0,0,0),(11,15,13,235))
    return Image.alpha_composite(img,det).resize((size_px,size_px),Image.LANCZOS)

if __name__=='__main__':
    badge(512).save('badge512.png')
    sheet=Image.new('RGBA',(760,560),(247,244,237,255))
    x=8
    for sz in (256,96,64,48,36,28,22):
        b=badge(sz); sheet.paste(b,(x,540-sz-8),b); x+=sz+14
    sheet.save('sizes.png')
    print('v5 rendered')
