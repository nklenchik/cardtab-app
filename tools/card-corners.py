import glob,os
from PIL import Image,ImageDraw,ImageChops,ImageFilter
src='artfix/orig';dst='artfix/out';os.makedirs(dst,exist_ok=True)
def process(path):
    im=Image.open(path).convert('RGBA');w,h=im.size
    # find where the card is (anything that isn't the surrounding background), only to get its bounds
    rgb=im.convert('RGB');mark=rgb.copy();KEY=(255,0,255)
    for c in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]:
        if mark.getpixel(c)!=KEY: ImageDraw.floodfill(mark,c,KEY,thresh=40)
    card=Image.eval(ImageChops.difference(mark,Image.new('RGB',(w,h),KEY)).convert('L'),lambda v:255 if v>8 else 0)
    # bounds = where most of a row/column is card (ignores the curved corners themselves)
    px=card.load()
    cols=[sum(1 for y in range(h) if px[x,y]) for x in range(w)];rows=[sum(1 for x in range(w) if px[x,y]) for y in range(h)]
    L=next(x for x in range(w) if cols[x]>h*.6);R=max(x for x in range(w) if cols[x]>h*.6)+1
    T=next(y for y in range(h) if rows[y]>w*.6);B=max(y for y in range(h) if rows[y]>w*.6)+1
    im=im.crop((L,T,R,B));card=card.crop((L,T,R,B));w,h=im.size;cp=card.load()
    # a clean, perfectly smooth rounded corner. Real cards are about 4.8% of the width; some scans have rounder corners,
    # so grow the radius until no leftover background sits inside the curve at any corner
    def leftovers(rr):
        n=0;k=int(rr)+2
        for cx,cy,sx,sy in ((rr,rr,0,0),(w-rr,rr,w-k,0),(rr,h-rr,0,h-k),(w-rr,h-rr,w-k,h-k)):
            for y in range(sy,sy+k):
                for x in range(sx,sx+k):
                    inside=not((x<rr or x>w-rr)and(y<rr or y>h-rr)) or ((x+.5-cx)**2+(y+.5-cy)**2)<=(rr-1.2)**2
                    if inside and not cp[x,y]:n+=1
        return n
    r=w*0.056  # a touch rounder than a real card (4.8%), so no scan's own corner pokes outside the curve
    S=8;m=Image.new('L',(w*S,h*S),0);ImageDraw.Draw(m).rounded_rectangle((S*1.0,S*1.0,w*S-S*1.0-1,h*S-S*1.0-1),radius=r*S,fill=255)
    m=m.resize((w,h),Image.LANCZOS)
    im.putalpha(ImageChops.multiply(m,im.getchannel('A')))
    return im,(L,T,R,B,round(r/w*100,2))
for f in sorted(glob.glob(src+'/*.webp')):
    n=os.path.basename(f)
    if '-wall' in n or n.startswith('houndoom'): continue
    im,b=process(f);im.save(os.path.join(dst,n),'WEBP',quality=90,method=6,exact=True)
    print(n,Image.open(f).size,'->',im.size,b)
