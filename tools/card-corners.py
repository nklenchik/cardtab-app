import sys,glob,os
from PIL import Image,ImageDraw,ImageChops,ImageFilter
src='artfix/orig';dst='artfix/out';os.makedirs(dst,exist_ok=True)
def process(path):
    im=Image.open(path).convert('RGBA');w,h=im.size
    # 1) whatever surrounds the card (white page, gray screenshot background) becomes transparent: flood from each corner
    rgb=im.convert('RGB');mark=rgb.copy();KEY=(255,0,255)
    for c in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]:
        if mark.getpixel(c)!=KEY: ImageDraw.floodfill(mark,c,KEY,thresh=40)
    bg=Image.eval(ImageChops.difference(mark,Image.new('RGB',(w,h),KEY)).convert('L'),lambda v:255 if v>8 else 0)  # 255 = card
    # pull the edge in a hair so no light fringe from the old background is left, then smooth it
    k=5 if w>=300 else 3
    bg=bg.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.GaussianBlur(0.8 if w>=300 else 0.5))
    bbox=bg.getbbox() or (0,0,w,h)
    im=im.crop(bbox);bg=bg.crop(bbox);w,h=im.size
    # 2) round the corners like a real card (radius about 4.6% of the width), smooth edge via 4x supersampling
    r=round(w*0.046);S=4;m=Image.new('L',(w*S,h*S),0);ImageDraw.Draw(m).rounded_rectangle((0,0,w*S-1,h*S-1),radius=r*S,fill=255);m=m.resize((w,h),Image.LANCZOS)
    alpha=ImageChops.multiply(m,bg)
    a0=im.getchannel('A');im.putalpha(ImageChops.multiply(alpha,a0))
    return im,bbox
for f in sorted(glob.glob(src+'/*.webp')):
    n=os.path.basename(f)
    if '-wall' in n or n.startswith('houndoom'): continue
    im,bbox=process(f)
    im.save(os.path.join(dst,n),'WEBP',quality=88,method=6)
    print(n,Image.open(f).size,'->',im.size,'crop',bbox)
