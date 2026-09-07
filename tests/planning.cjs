// Run: node tests/planning.cjs (Playwright available via NODE_PATH or local install).
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  try {res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(file));}
  catch {res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,channel:process.env.TEST_BROWSER || 'chrome'});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Madrid',serviceWorkers:'block'});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('[data-id="calentamiento"]').count(),1);
    // Preserve an old active workout while using the new independent warmup.
    await page.evaluate(()=>{ S.active={dayId:'upper-a',t0:Date.now(),sets:{'press-banca|Press de banca':[true]},kg:{},warm:{0:true},rounds:{}};save(); });
    await page.reload();
    await page.locator('[data-id="calentamiento"]').click();
    await page.locator('[data-act="warm-check"]').first().click();
    await page.locator('[data-act="warm-done"]').click();
    assert.equal(await page.evaluate(()=>S.active.sets['press-banca|Press de banca'][0]),true);
    assert.equal(await page.evaluate(()=>warmRecord().done),true);
    await page.reload();
    assert.equal(await page.evaluate(()=>warmRecord().done),true);
    await page.locator('[data-act="tab"][data-v="semana"]').click();
    await page.locator('#plan-upper-a').selectOption('4');
    assert.equal(await page.evaluate(()=>planFor(Date.now())['upper-a']),4);
    // Reject collisions, preserve existing assignment.
    await page.locator('#plan-upper-a').selectOption('1');
    assert.equal(await page.locator('#plan-upper-a').inputValue(),'4');
    await page.locator('[data-act="plan-week"][data-n="1"]').click();
    await page.locator('#plan-upper-a').selectOption('6');
    await page.reload();
    assert.equal(await page.locator('#plan-upper-a').inputValue(),'4');
    await page.locator('[data-act="plan-week"][data-n="1"]').click();
    assert.equal(await page.locator('#plan-upper-a').inputValue(),'6');
    await page.locator('#plan-upper-a').selectOption('-1');
    assert.equal(await page.locator('#plan-upper-a').inputValue(),'-1');
    // Today follows the calendar, and extras don't inflate weekly completion.
    const actual = await page.evaluate(()=>{
      const today=(new Date().getDay()+6)%7;
      S.plans[dateKey(new Date(weekStart(Date.now())))]=Object.fromEntries(P.days.map(d=>[d.id,d.id==='upper-b'?today:-1]));
      S.history=[{dayId:'upper-b',ts:Date.now()},{dayId:'movilidad',ts:Date.now()},{dayId:'agarre',ts:Date.now()}];
      return {today:todayDay().id,count:weekSessions().size,embedded:P.days.some(d=>d.blocks.some(b=>b.t==='warmup'))};
    });
    assert.deepEqual(actual,{today:'upper-b',count:1,embedded:false});
    // Old copies and corrupt new fields receive safe defaults.
    assert.equal(await page.evaluate(()=>{const old={plans:[],warmups:{bad:null}};normalizePlanning(old);return Object.keys(old.plans).length+Object.keys(old.warmups).length;}),0);
    await page.evaluate(()=>go('hoy'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(root,'tests','mobile-preview.png'),fullPage:true});
    await page.evaluate(()=>go('semana'));
    await page.screenshot({path:path.join(root,'tests','planner-preview.png'),fullPage:true});
    await page.evaluate(()=>go('day','calentamiento'));
    await page.screenshot({path:path.join(root,'tests','warmup-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: migration, active workout preservation, warmup persistence, weekly planning, collision checks, today, stats and mobile width.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
