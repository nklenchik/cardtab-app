# Rebuilds stories2.tpl.html from the v38 base plus the v39 Stories module.
s=open('stories2.v38.bak.html').read()
a="  return {lab,stories:["; assert a in s
s=s.replace(a,"  return {lab,x:{t,roi,f0,bigSale,plats,by,M,under,one,wk,WB,nbE,soldE,hold,hv,L,cum,mo1},stories:[")
css=open('stories-v39.css').read(); i=s.rfind('</style>'); s=s[:i]+css+s[i:]
m="\n})();\n\n// v33.1"; assert m in s; s=s.replace(m,"\n"+open('stories-v39.js').read()+m,1)
open('stories2.tpl.html','w').write(s)
