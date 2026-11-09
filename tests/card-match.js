const fs=require('fs');eval(fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../tools/cardmatch.js'),'utf8')+';global.CM=CM');
let id=0;const E=(type,name,no,date,amount,o={})=>Object.assign({id:'e'+(++id),type,name,no,date,amount,qty:1,set:'',net:type==='sale'?amount:null},o);
const rows=[
 E('purchase','Flygon','088/080','2026-06-28',810,{qty:3}),
 E('sale','Flygon','15/97','2026-08-25',5400,{net:3809}),
 E('sale','Flygon','15/97','2025-01-16',7287,{net:6499}),
 E('purchase','Wartortle','','2026-03-01',500),
 E('sale','Wartortle - 008/165 - 151','','2026-04-01',1200,{set:'151'}),
 E('purchase','Gengar','','2026-01-01',1000,{grade:{co:'PSA',g:'10'}}),
 E('sale','Gengar','','2026-02-01',3000),                      // raw sale must not join a PSA 10 buy
 E('purchase','Mew','040','2026-01-01',2000),E('purchase','Mew','151','2026-01-01',2000),
 E('sale','Mew','','2026-02-01',3000),                           // two Mews could fit: stays alone
 E('purchase','Pikachu','25/102','2026-05-01',100),
 E('sale','Pikachu','','2026-04-01',900),                        // sold before bought: stays alone
 E('purchase','Charizard','4/102','2026-01-01',10000,{set:'Base Set'}),
 E('sale','Charizard','4/102','2026-02-01',20000,{set:'Jungle'}), // set disagrees
 E('sale','Charizard 004/102','','2026-03-01',20000),            // number written in the name, leading zeros
 E('purchase','Lugia','9/111','2026-01-01',500),E('purchase','Lugia','9/111','2026-02-01',500,{set:'Neo Genesis'}),E('sale','Lugia','9/111','2026-03-01',900,{set:'Neo Genesis'}),
 E('purchase','Umbreon','SWSH095','2026-01-01',100),E('sale','Umbreon SWSH 95','','2026-02-01',500),
];
const L0=rows.length;const f=CM.make(rows),k=i=>f(rows[i]);let bad=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)bad++};
ok(k(1)!==k(0)&&k(2)!==k(0),'Flygon 15/97 sales stay off the 088/080 buy');
ok(k(4)===k(3),'Wartortle sale with number and set in its name joins the plain buy');
ok(k(6)!==k(5),'raw Gengar sale does not join a PSA 10 buy');
ok(k(9)!==k(7)&&k(9)!==k(8),'Mew with no number and two possible buys stays alone');
ok(k(11)!==k(10),'Pikachu sold before it was bought stays alone');
ok(k(13)!==k(12),'Charizard with a different set stays alone');
ok(k(14)===k(12),'Charizard 004/102 in the name joins 4/102');
ok(k(19)===k(18),'Umbreon SWSH 95 joins SWSH095');
ok(k(15)===k(14+1)&&k(16)===k(15)&&k(17)===k(15),'Lugia bought with and without the set, sold with it: one card');
const buys=[E('purchase','X','','2026-01-01',300,{qty:3}),E('purchase','X','','2026-03-01',900)];
const r1=CM.saleCost(buys,{date:'2026-02-01',qty:1}),r2=CM.saleCost(buys,{date:'2026-04-01',qty:2}),r0=CM.saleCost(buys,{date:'2025-12-01'});
ok(r1.cost===100&&r1.bought==='2026-01-01','sale after the first buy only costs that buy ('+JSON.stringify(r1)+')');
ok(r2.cost===600&&r2.bought==='2026-03-01','sale after both buys uses the average of both ('+JSON.stringify(r2)+')');
ok(r0===null,'sale before any buy has no cost');
process.exit(bad?1:0)
