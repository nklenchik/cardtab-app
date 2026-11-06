const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
 for (const [n,o,clip] of [['phone',{ ...devices['iPhone 13'], viewport:{width:390,height:760}, colorScheme:'light' },{x:0,y:660,width:390,height:100}],['phone-dark',{ ...devices['iPhone 13'], viewport:{width:390,height:760}, colorScheme:'dark' },{x:0,y:660,width:390,height:100}],['desk',{viewport:{width:1280,height:300}},{x:180,y:10,width:420,height:80}]]) {
  const p = await (await b.newContext({...o, deviceScaleFactor:2})).newPage();
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'tests/out-phone/icon-'+n+'.png', clip });
 } await b.close(); })();
