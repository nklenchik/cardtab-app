import re,sys
s=open(sys.argv[1]).read()
blocks=re.findall(r'<style[^>]*>(.*?)</style>',s,flags=re.S)
css='\n'.join(blocks)
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
def parse(t):
    out=[];i=0;n=len(t)
    while i<n:
        j=t.find('{',i)
        if j<0:break
        sel=t[i:j].strip()
        d=1;k=j+1
        while d and k<n:
            if t[k]=='{':d+=1
            elif t[k]=='}':d-=1
            k+=1
        body=t[j+1:k-1]
        out.append((sel,body));i=k
    return out
keep=lambda sel: ('ct-' in sel) or sel.startswith('@font-face') or re.fullmatch(r':root(:not\(\[data-theme="light"\]\))?|:root\[data-theme="dark"\]',sel)
res=[]
for sel,body in parse(css):
    if sel.startswith('@media') or sel.startswith('@supports'):
        inner=[(a,b) for a,b in parse(body) if keep(a) or (a.startswith(':root') and '{' not in b and 'ct-' not in a and ('--' in b))]
        # nested root var blocks inside media
        inner2=[]
        for a,b in parse(body):
            if keep(a): inner2.append((a,b))
        if inner2: res.append(sel+'{'+''.join(a+'{'+b.strip()+'}' for a,b in inner2)+'}')
    elif sel.startswith('@keyframes'):
        res.append(('KF',sel,body))
    elif keep(sel):
        res.append(sel+'{'+body.strip()+'}')
txt='\n'.join(r for r in res if isinstance(r,str))
used=set(re.findall(r'animation(?:-name)?\s*:\s*([\w-]+)',txt))
kf='\n'.join(r[1]+'{'+r[2].strip()+'}' for r in res if not isinstance(r,str) and r[1].split()[-1] in used)
txt=re.sub(r'url\(/fonts/','url(../fonts/',txt)
print(txt+'\n'+kf)
