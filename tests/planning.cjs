// Run: node tests/planning.cjs (Playwright available via NODE_PATH or local install).
// Entreno 4.0: Upper único y Lower, pestaña Entrenos, entreno sin campos de peso con
// botón Ir al reloj, reloj que anota al final del ejercicio, migración desde 3.x.
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const VERSION = (fs.readFileSync(path.join(root,'index.html'),'utf8').match(/version:\s*'([^']+)'/)||[])[1];
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  try {res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
  catch {res.writeHead(404).end();}
});
const MONDAY = '2026-11-02T18:00:00+01:00', FRIDAY = '2026-11-06T18:00:00+01:00';
const shots = path.join(root,'tests');

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const URL0 = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless:true,channel:process.env.TEST_BROWSER || 'chrome'});
  const errors=[];
  async function open(when, init, url=URL0, width=390){
    const ctx = await browser.newContext({viewport:{width,height:844},timezoneId:'Europe/Madrid',serviceWorkers:'block'});
    const page = await ctx.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{ if(m.type()==='error' && !/favicon/.test(m.text())) errors.push(m.text()); });
    page.on('dialog',d=>d.accept());
    await page.clock.install({time:new Date(when)});
    if (init) await page.addInitScript(([k,v])=>{ if(!sessionStorage.getItem('seeded')){ localStorage.setItem(k,v); sessionStorage.setItem('seeded','1'); } }, ['fit.v2', JSON.stringify(init)]);
    await page.goto(url);
    return {ctx,page};
  }
  const txt = (page, sel='#app') => page.locator(sel).innerText();
  async function checkLayout(page, width, view, day){
    await page.setViewportSize({width,height:844});
    await page.evaluate(({view,day})=>go(view,day),{view,day});
    await page.waitForTimeout(120);
    const L = await page.evaluate(()=>{
      const els=[...document.querySelectorAll('#app button,#app select,#app input,#app a[href],#app summary')].filter(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        const shut=el.closest('details:not([open])');
        return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&!(shut&&!el.matches('summary'));
      });
      const overlaps=[];
      for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
        const a=els[i],b=els[j]; if(a.contains(b)||b.contains(a))continue;
        const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
        if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)overlaps.push([a.outerHTML.slice(0,70),b.outerHTML.slice(0,70)]);
      }
      const small=els.filter(el=>el.matches('button,select,input')&&el.getBoundingClientRect().height<44).map(el=>(el.dataset.act||el.className||el.tagName)+':'+Math.round(el.getBoundingClientRect().height));
      const misaligned=[...document.querySelectorAll('#app .btnrow')].flatMap(g=>{
        const c=[...g.children].filter(el=>el.matches('button,a.btn')).map(el=>el.getBoundingClientRect());
        return c.length<2||c.every(r=>Math.abs(r.height-c[0].height)<=2)?[]:[g.className];
      });
      return {overflow:document.documentElement.scrollWidth>innerWidth, overlaps, small, misaligned,
        broken:/undefined|NaN|Invalid Date|\[object Object\]/.test(document.body.innerText)};
    });
    const where = `${view}/${day||''} at ${width}px`;
    assert.equal(L.overflow,false,`${where} overflows`);
    assert.deepEqual(L.overlaps,[],`${where} has overlapping controls`);
    assert.deepEqual(L.small,[],`${where} has controls under 44px`);
    assert.deepEqual(L.misaligned,[],`${where} has misaligned button groups`);
    assert.equal(L.broken,false,`${where} prints broken values`);
  }
  try {
    /* ---------- 1. Datos de la 3.x: plan, historial, alternativas, sesión abierta y reloj ---------- */
    const legacy = {
      settings:{restStrength:120,restStandard:60,sound:false,vibe:false},
      readiness:{'2026-11-02':'alta'},
      history:[{id:'s1',dayId:'upper-a',ts:Date.parse('2026-10-26T18:00:00+01:00'),vol:1500,dur:36e5,entries:[{id:'press-banca',nm:'Press de banca',sets:3,reps:'8 / 8 / 7',kg:60,setData:[{kg:60,reps:8},{kg:60,reps:8},{kg:57.5,reps:7}]}]},
               {id:'s2',dayId:'upper-b',ts:Date.parse('2026-10-29T18:00:00+01:00'),vol:900,entries:[{id:'curl-martillo',nm:'Curl martillo',sets:2,reps:'12 / 12',kg:14,setData:[{kg:14,reps:12},{kg:14,reps:12}]}]}],
      plans:{'2026-11-02':{'upper-a':0,pierna:1,'upper-b':3,crossfit:2},'2026-11-09':{'upper-a':0,'upper-b':5,pierna:-1,crossfit:2}},
      drafts:{'upper-b':{'jalon-neutro|Jalón al pecho neutro':'dominadas-bw'}},
      active:{dayId:'upper-a',t0:Date.parse('2026-10-31T10:00:00+01:00'),sets:{'remo|Remo':[true,true]},setLog:{'remo|Remo':[{kg:50,reps:10},{kg:50,reps:9}]},exercises:[{_uid:'remo|Remo',id:'remo',nm:'Remo en máquina con apoyo'}],kg:{},rounds:{}},
      clock:{phase:'rest',exId:'sentadilla',exNm:'Sentadilla con barra',sets:3,rest:150,i:0,log:[{kg:90,reps:5}],t0:1,restEnd:Date.parse(MONDAY)+60000,restTotal:150000,runId:Date.parse(MONDAY)-60000,ref:{kg:85,setData:[{kg:85,reps:5}]}}
    };
    let {ctx,page} = await open(MONDAY, legacy);
    const mig = await page.evaluate(()=>({
      plans:S.plans, days:[...new Set(S.history.map(h=>h.dayId))].sort(), drafts:S.drafts, active:'active' in S, readiness:'readiness' in S,
      closed:S.history.find(h=>h.id.startsWith('s'+Date.parse('2026-10-31T10:00:00+01:00'))),
      clock:{phase:S.clock.phase,items:S.clock.items,done:S.clock.done,rows:S.clock.rows,ref:Object.keys(S.clock.ref)}
    }));
    assert.deepEqual(mig.plans,{'2026-11-02':['upper','pierna','crossfit','upper',null,null,null],'2026-11-09':['upper',null,'crossfit',null,null,'upper',null]});
    assert.deepEqual(mig.days,['upper']);
    assert.deepEqual(mig.drafts,{upper:{'jalon-neutro|Jalón al pecho neutro':'dominadas-bw'}});
    assert.equal(mig.active,false); assert.equal(mig.readiness,false);
    assert.deepEqual(mig.closed.entries.map(e=>[e.id,e.setData]),[['remo',[{kg:50,reps:10},{kg:50,reps:9}]]],'a half-done 3.x session is kept');
    assert.equal(mig.closed.dayId,'upper');
    assert.deepEqual(mig.clock,{phase:'rest',items:[{id:'sentadilla',nm:'Sentadilla con barra'}],done:1,rows:{sentadilla:[{kg:90,reps:5}]},ref:['sentadilla']},'a 3.x clock in rest keeps going');
    assert.match(await page.locator('.ck-banner').innerText(),/Descansando[\s\S]*Sentadilla con barra[\s\S]*Serie 2 de 3/i);
    await ctx.close();
    // Old home-screen icons and links still land on the unified Upper.
    for (const url of [URL0+'index.html?d=upper-a', URL0+'index.html?d=upper-b', URL0+'#day/upper-a']) {
      ({ctx,page} = await open(MONDAY, null, url));
      assert.equal(await page.locator('#top h1').innerText(),'Upper', url);
      await ctx.close();
    }

    /* ---------- 2. Entrenos: lo que toca hoy y la lista ---------- */
    ({ctx,page} = await open(MONDAY));
    assert.deepEqual(await page.locator('#nav button').evaluateAll(els=>els.map(el=>[el.dataset.v,el.innerText.trim()])),[['hoy','Entrenos'],['reloj','Reloj'],['historial','Registro'],['ajustes','Ajustes']]);
    assert.equal(await page.locator('#top h1').innerText().then(t=>t.startsWith('Entrenos')),true);
    assert.equal(await page.locator('.readiness').count(),0,'no «Cómo llegas hoy»');
    assert.doesNotMatch(await txt(page),/Cómo llegas/i);
    assert.equal(await page.locator('.herocard h2').innerText(),'Upper');
    assert.deepEqual(await page.locator('.hero-list li').allInnerTexts(),['Press de banca','Jalón al pecho neutro','Remo en máquina con apoyo','Landmine press','Elevaciones laterales + Pájaros','Curl de bíceps + Extensión de tríceps sobre cabeza']);
    assert.deepEqual(await page.locator('.cards').first().locator('.tt').allInnerTexts(),['Upper','Lower','Metabólico + core']);
    assert.match(await page.locator('.dcard').first().innerText(),/Lunes · Jueves/i);
    assert.equal(await page.locator('[data-id="calentamiento"]').count(),2,'warm-up card on gym days and in the list');
    assert.match(await page.locator('.week-line').innerText(),/0 de 4/i);
    await page.screenshot({path:path.join(shots,'mobile-preview.png'),fullPage:true});
    await ctx.close();
    // A rest day proposes mobility or stretching.
    ({ctx,page} = await open(FRIDAY));
    assert.match(await page.locator('.herocard').innerText(),/Día de descanso/i);
    assert.deepEqual(await page.locator('.herocard [data-act="open"]').evaluateAll(b=>b.map(x=>x.dataset.id)),['movilidad','estiramientos']);
    assert.equal(await page.locator('.warm-entry').count(),0);
    await page.screenshot({path:path.join(shots,'rest-day-preview.png'),fullPage:true});
    await page.locator('.herocard [data-id="estiramientos"]').click();
    assert.equal(await page.locator('#top h1').innerText(),'Estiramientos');
    assert.equal(await page.locator('.witem').count(),12);
    assert.equal(await page.locator('[data-act="to-clock"]').count(),0,'holds have no clock button');
    await page.locator('.witem summary').first().click();
    assert.match(await page.locator('.witem').first().innerText(),/Inhala por la nariz/i);
    await page.screenshot({path:path.join(shots,'stretching-preview.png'),fullPage:true});
    // Planner: the same training on several days, rest days, warnings.
    await page.evaluate(()=>go('semana'));
    assert.equal(await page.locator('select[data-plan-day]').count(),7);
    await page.locator('#plan-4').selectOption('upper');
    assert.deepEqual(await page.evaluate(()=>planFor(Date.now())),['upper','pierna','crossfit','upper','upper',null,null]);
    assert.match(await txt(page),/Upper el jueves y el viernes seguidos/i);
    await page.screenshot({path:path.join(shots,'planner-preview.png'),fullPage:true});
    await page.evaluate(()=>go('hoy'));
    assert.equal(await page.locator('.herocard h2').innerText(),'Upper','today follows the plan');
    assert.match(await page.locator('.dcard').first().innerText(),/Lunes · Jueves · Viernes/i);
    await page.evaluate(()=>go('semana'));
    await page.locator('#plan-4').selectOption('');
    await page.locator('#plan-1').selectOption('crossfit');
    assert.match(await txt(page),/Lower y Metabólico|Metabólico/i);
    await page.locator('[data-act="plan-week"][data-n="1"]').click();
    assert.deepEqual(await page.evaluate(()=>planFor(planDate())),['upper','pierna','crossfit','upper',null,null,null],'other weeks keep the default');
    await ctx.close();

    /* ---------- 3. El programa: Upper único y Lower ---------- */
    ({ctx,page} = await open(MONDAY));
    const prog = await page.evaluate(()=>({
      ids:P.days.map(d=>d.id), names:P.days.map(d=>d.name),
      upper:flatEx(dayById('upper')).map(e=>[e.id,e.sets,e.reps]),
      lower:flatEx(dayById('pierna')).map(e=>e.id),
      units:dayUnits(dayById('upper')).map(u=>u.map(e=>e.id).join('+')),
      extras:P.extras.map(d=>d.id)
    }));
    assert.deepEqual(prog.ids,['upper','pierna','crossfit']);
    assert.deepEqual(prog.names,['Upper','Lower','Metabólico + core']);
    assert.deepEqual(prog.upper,[['press-banca',4,'6–8'],['jalon-neutro',4,'6–8'],['remo',3,'8–12'],['landmine',2,'8–10/lado'],['elev-laterales',3,'12–15'],['pajaros',3,'12–15'],['curl-biceps',3,'10–12'],['triceps-overhead',3,'10–15']]);
    assert.deepEqual(prog.lower,['sentadilla','bulgara','nordico','gemelo','pallof','rueda']);
    assert.deepEqual(prog.units,['press-banca','jalon-neutro','remo','landmine','elev-laterales+pajaros','curl-biceps+triceps-overhead']);
    assert.ok(prog.extras.includes('estiramientos'));

    /* ---------- 4. Dentro del entreno: ver y Ir al reloj, sin campos de peso ---------- */
    await page.evaluate(()=>{S.history=[{id:'p',dayId:'upper',ts:Date.now()-7*864e5,vol:1400,dur:36e5,entries:[{id:'press-banca',nm:'Press de banca',sets:4,reps:'8 / 8 / 7 / 7',kg:62.5,setData:[{kg:62.5,reps:8},{kg:62.5,reps:8},{kg:60,reps:7},{kg:60,reps:7}]}]}];save();go('day','upper')});
    assert.equal(await page.locator('#app input').count(),0,'no kg or reps fields in the training');
    assert.equal(await page.locator('#app .dot').count(),0,'no set markers in the training');
    assert.equal(await page.locator('[data-act="to-clock"]').count(),6,'one button per exercise, one per superset');
    assert.deepEqual(await page.locator('.ss [data-act="to-clock"]').allInnerTexts(),['Ir al reloj · superserie','Ir al reloj · superserie']);
    assert.match(await page.locator('.ex').first().innerText(),/Última vez: 62.5×8 · 62.5×8 · 60×7 · 60×7/i);
    await page.screenshot({path:path.join(shots,'upper-preview.png'),fullPage:true});
    // ⋯ swaps the exercise of a slot; the clock then uses that one.
    await page.locator('.ex').nth(1).locator('[data-act="ex-menu"]').click();
    assert.equal(await page.evaluate(()=>document.querySelector('#scrim').classList.contains('on')),true);
    await page.locator('#exsheet select').selectOption('dominadas-asistidas');
    await page.locator('#exsheet [data-act="ex-menu-close"]').last().click();
    assert.match(await page.locator('.ex').nth(1).innerText(),/Dominadas asistidas[\s\S]*cambiado/i);

    /* ---------- 5. Reloj desde el entreno: series, descansos y anotar al final ---------- */
    await page.locator('.ex').first().locator('[data-act="to-clock"]').click();
    assert.equal(await page.evaluate(()=>VIEW),'reloj');
    const ready = await page.evaluate(()=>({items:S.clock.items,sets:S.clock.sets,rest:S.clock.rest,phase:S.clock.phase,day:S.clock.dayId}));
    assert.deepEqual(ready,{items:[{id:'press-banca',nm:'Press de banca'}],sets:4,rest:120,phase:'setup',day:'upper'});
    assert.match(await txt(page),/Upper · ejercicio 1 de 6[\s\S]*Objetivo 6–8 · la última vez 62.5×8/i);
    await page.screenshot({path:path.join(shots,'reloj-listo-preview.png')});
    await page.locator('[data-act="ck-rest"][data-d="15"]').click();
    await page.locator('[data-act="ck-start"]').click();
    assert.match(await page.locator('.ck-done').innerText(),/Serie hecha[\s\S]*descansar 2:15/i);
    assert.match(await txt(page),/la última vez 62.5×8/i);
    await page.screenshot({path:path.join(shots,'reloj-serie-preview.png')});
    await page.locator('[data-act="ck-setdone"]').click();
    assert.equal(await page.evaluate(()=>S.clock.phase),'rest');
    assert.match(await txt(page),/1 de 4 hechas[\s\S]*Siguiente: serie 2 de 4/i);
    // The rest survives a reload and its end starts the next set with an alarm.
    await page.reload();
    assert.equal(await page.evaluate(()=>S.clock.phase),'rest');
    await page.evaluate(()=>{S.clock.restEnd=Date.now()-10;clockTick()});
    assert.deepEqual(await page.evaluate(()=>[S.clock.phase,S.clock.done]),['work',1]);
    assert.match(await page.locator('.ck-big').innerText(),/2\s*\/ 4/i);
    for (let i=0;i<2;i++){ await page.locator('[data-act="ck-setdone"]').click(); await page.locator('[data-act="ck-skiprest"]').click(); }
    assert.match(await page.locator('.ck-done').innerText(),/y anotar/i,'the last set leads to the log');
    await page.locator('[data-act="ck-setdone"]').click();
    assert.equal(await page.evaluate(()=>S.clock.phase),'log');
    // Prefilled with last time, set by set; a new weight rolls down to the sets that had the same.
    const kgs = () => page.locator('[data-act="lg-kg"]').evaluateAll(els=>els.map(e=>e.value));
    const reps = () => page.locator('[data-act="lg-reps"]').evaluateAll(els=>els.map(e=>e.value));
    assert.deepEqual(await kgs(),['62.5','62.5','60','60']);
    assert.deepEqual(await reps(),['8','8','7','7']);
    await page.screenshot({path:path.join(shots,'reloj-anotar-preview.png')});
    await page.locator('[data-act="lg-kg"]').first().fill('65');
    assert.deepEqual(await kgs(),['65','65','60','60']);
    await page.locator('[data-act="lg-reps"]').nth(3).fill('6');
    await page.locator('[data-act="ck-save"]').click();
    const saved = await page.evaluate(()=>{const h=S.history[0];return {id:h.id,day:h.dayId,e:h.entries.map(e=>[e.id,e.kg,e.setData]),pr:S.prs['press-banca'].kg,phase:S.clock.phase}});
    assert.deepEqual(saved,{id:'r-2026-11-02-upper',day:'upper',e:[['press-banca',65,[{kg:65,reps:8},{kg:65,reps:8},{kg:60,reps:7},{kg:60,reps:6}]]],pr:65,phase:'done'});
    assert.match(await txt(page),/\+2.5 kg vs la última/i);
    assert.match(await page.locator('[data-act="ck-next"]').innerText(),/Dominadas asistidas/i);
    await page.screenshot({path:path.join(shots,'reloj-hecho-preview.png')});
    // One more set: rest → set → log again; the entry is replaced, not duplicated.
    await page.locator('[data-act="ck-more"]').click();
    await page.locator('[data-act="ck-skiprest"]').click();
    await page.locator('[data-act="ck-setdone"]').click();
    assert.deepEqual(await kgs(),['65','65','60','60','60']);
    await page.locator('[data-act="ck-save"]').click();
    assert.deepEqual(await page.evaluate(()=>S.history[0].entries.map(e=>[e.id,e.sets])),[['press-banca',5]]);
    // Next exercise straight from the clock.
    await page.locator('[data-act="ck-next"]').click();
    assert.deepEqual(await page.evaluate(()=>[S.clock.phase,S.clock.items[0].id,S.clock.sets]),['setup','dominadas-asistidas',4]);
    // The training shows what is done today.
    await page.evaluate(()=>go('day','upper'));
    assert.match(await page.locator('.ex').first().innerText(),/Hoy: 65×8 · 65×8 · 60×7 · 60×6 · 60×6/i);
    assert.match(await page.locator('.ex').first().locator('[data-act="to-clock"]').innerText(),/Otra vez al reloj/i);
    assert.equal(await page.locator('.ex.full').count(),1);

    /* ---------- 6. Superserie, guardas y terminar antes ---------- */
    await page.locator('.ss').first().locator('[data-act="to-clock"]').click();
    assert.deepEqual(await page.evaluate(()=>[S.clock.items.map(x=>x.id),S.clock.sets,S.clock.rest]),[['elev-laterales','pajaros'],3,60]);
    assert.match(await txt(page),/Superserie: haz los dos seguidos/i);
    await page.locator('[data-act="ck-start"]').click();
    assert.match(await txt(page),/Ronda[\s\S]*Ronda hecha/i);
    // Another exercise can't start while this one runs: the button takes you back here.
    await page.evaluate(()=>go('day','upper'));
    assert.match(await page.locator('.ck-banner').innerText(),/Serie en marcha[\s\S]*Elevaciones laterales \+ Pájaros/i);
    assert.equal(await page.locator('.to-clock.live').count(),1);
    await page.locator('.ex').nth(2).locator('[data-act="to-clock"]').click();
    assert.equal(await page.evaluate(()=>VIEW),'reloj');
    assert.deepEqual(await page.evaluate(()=>S.clock.items.map(x=>x.id)),['elev-laterales','pajaros']);
    assert.match(await page.locator('#toast').innerText(),/sigue en el reloj/i);
    await page.locator('[data-act="ck-setdone"]').click();
    await page.locator('[data-act="ck-skiprest"]').click();
    await page.locator('[data-act="ck-setdone"]').click();
    await page.locator('[data-act="ck-finish"]').click();
    assert.equal(await page.locator('.lg-card').count(),2,'one card per exercise of the pair');
    assert.equal(await page.locator('[data-act="lg-kg"]').count(),4,'only the two rounds done');
    assert.equal(await page.locator('[data-act="ck-save"]').isDisabled(),false);
    await page.locator('[data-act="lg-kg"]').nth(0).fill('10');
    await page.locator('[data-act="lg-reps"]').nth(0).fill('14');
    await page.locator('[data-act="lg-reps"]').nth(1).fill('12');
    await page.locator('[data-act="lg-kg"]').nth(2).fill('8');
    await page.locator('[data-act="lg-reps"]').nth(2).fill('15');
    await page.locator('[data-act="lg-reps"]').nth(3).fill('15');
    await page.locator('[data-act="ck-save"]').click();
    assert.deepEqual(await page.evaluate(()=>S.history[0].entries.filter(e=>e.id!=='press-banca').map(e=>[e.id,e.setData])),
      [['elev-laterales',[{kg:10,reps:14},{kg:10,reps:12}]],['pajaros',[{kg:8,reps:15},{kg:8,reps:15}]]]);
    // Leaving without saving and cancelling with no sets done.
    await page.locator('[data-act="ck-new"]').click();
    await page.locator('[data-act="ck-ex"]').selectOption('sentadilla');
    assert.deepEqual(await page.evaluate(()=>[S.clock.dayId,S.clock.sets]),['',3]);
    await page.locator('[data-act="ck-start"]').click();
    await page.locator('[data-act="ck-finish"]').click();
    assert.equal(await page.evaluate(()=>S.clock.phase),'setup','no sets: the exercise is cancelled');
    await page.locator('[data-act="ck-start"]').click();
    await page.locator('[data-act="ck-setdone"]').click();
    await page.locator('[data-act="ck-finish"]').click();
    await page.locator('[data-act="ck-discard"]').click();
    assert.equal(await page.evaluate(()=>[S.clock.phase,S.history.some(h=>h.entries.some(e=>e.id==='sentadilla'))].join()),'setup,false');
    // A custom exercise typed by hand goes to the day's «Reloj» session.
    await page.locator('[data-act="ck-ex"]').selectOption('__new');
    await page.locator('[data-act="ck-custom"]').fill('Press militar');
    await page.locator('[data-act="ck-start"]').click();
    await page.locator('[data-act="ck-finish"]').click();
    await page.locator('[data-act="ck-start"]').click();
    await page.locator('[data-act="ck-setdone"]').click();
    await page.locator('[data-act="ck-finish"]').click();
    await page.locator('[data-act="lg-kg"]').first().fill('30');
    await page.locator('[data-act="lg-reps"]').first().fill('10');
    await page.locator('[data-act="ck-save"]').click();
    assert.deepEqual(await page.evaluate(()=>{const h=S.history.find(x=>x.dayId==='reloj');return [h.id,h.entries[0].id,h.entries[0].setData]}),['r-2026-11-02','c-press-militar',[{kg:30,reps:10}]]);
    assert.equal(await page.locator('[data-act="ck-next"]').count(),0);

    /* ---------- 7. Rondas del metabólico y extras de casa ---------- */
    for (const [id,sec] of [['crossfit','1200'],['casa-20','900'],['casa-libre-suave','900']]) {
      await page.evaluate(id=>go('day',id),id);
      assert.equal(await page.locator('[data-act="wod"]').getAttribute('data-sec'),sec);
      assert.equal(await page.locator('[data-act="rnd"][data-d="-1"]').isDisabled(),true);
      await page.locator('[data-act="rnd"][data-d="1"]').click();
      await page.locator('[data-act="rnd"][data-d="1"]').click();
      await page.reload();
      assert.equal(await page.locator('.rounds-n').innerText(),'2');
      assert.deepEqual(await page.evaluate(id=>{const h=S.history.find(x=>x.id==='r-2026-11-02-'+id);return [h.dayId,h.entries[0].sets,h.entries[0].reps]},id),[id,2,'rondas']);
      await page.locator('[data-act="rnd"][data-d="-1"]').click();
      await page.locator('[data-act="rnd"][data-d="-1"]').click();
      assert.equal(await page.evaluate(id=>S.history.some(x=>x.id==='r-2026-11-02-'+id),id),false,'zero rounds leaves no empty session');
    }
    await page.evaluate(()=>go('day','crossfit'));
    assert.equal(await page.locator('[data-act="to-clock"]').count(),2,'the two preparation exercises go to the clock');
    await page.locator('[data-act="wod"]').click();
    assert.equal(await page.evaluate(()=>RT.running),true);
    await page.locator('[data-act="timer-minimize"]').click();
    await page.evaluate(()=>skipRest());
    await page.screenshot({path:path.join(shots,'crossfit-preview.png'),fullPage:true});

    /* ---------- 8. Registro ---------- */
    await page.evaluate(()=>go('historial'));
    assert.deepEqual((await page.locator('.hitem .m b').allInnerTexts()).slice(0,3),['Reloj','Upper','Upper']);
    await page.locator('[data-act="lift-sel"]').selectOption('elev-laterales');
    await page.reload();
    await page.evaluate(()=>go('historial'));
    assert.equal(await page.locator('[data-act="lift-sel"]').inputValue(),'elev-laterales');
    await page.locator('.manual summary').click();
    await page.locator('[data-act="mn-ex"]').selectOption('press-banca');
    assert.equal(await page.locator('[data-act="mn-kg"]').count(),5,'prefills as many sets as last time');
    await page.locator('[data-act="mn-save"]').click();
    assert.equal(await page.evaluate(()=>S.history.some(h=>h.dayId==='manual')),true);
    // A damaged backup no longer breaks the screens.
    await page.evaluate(()=>{localStorage.setItem('fit.v2',JSON.stringify({history:[null,{id:'z',dayId:'upper-a',ts:Date.now(),vol:'x',entries:[null,'roto',{id:'remo',nm:'Remo',sets:'2',reps:'10',kg:'mal',setData:[null,{kg:'x',reps:'y'},{kg:'40',reps:'10'}]}]}],plans:{'2026-11-02':'roto','x':[]},clock:{phase:'log',items:'mal'}}))});
    await page.reload();
    const healed=await page.evaluate(()=>{go('historial');const h=S.history[0];
      return {sessions:S.history.length,day:h.dayId,sets:h.entries[0].setData,plans:S.plans,clock:S.clock.phase,
        broken:/undefined|NaN|Invalid Date|\[object Object\]/.test(document.body.innerText)}});
    assert.deepEqual(healed,{sessions:1,day:'upper',sets:[{kg:40,reps:10}],plans:{},clock:'setup',broken:false});
    // Importing a 3.x backup goes through the same migration.
    await page.evaluate(l=>{S=sanitizeState(JSON.parse(JSON.stringify(l)));save();go('hoy')},legacy);
    assert.equal(await page.evaluate(()=>S.plans['2026-11-02'].join()),'upper,pierna,crossfit,upper,,,');
    await ctx.close();

    /* ---------- 9. Diseño en móvil, tablet y todas las pantallas del reloj ---------- */
    ({ctx,page} = await open(MONDAY, {history:[{id:'p',dayId:'upper',ts:Date.parse(MONDAY)-7*864e5,vol:1400,entries:[{id:'press-banca',nm:'Press de banca',sets:2,reps:'8 / 8',kg:60,setData:[{kg:60,reps:8},{kg:60,reps:8}]}]}]}));
    for (const width of [320,390,768])
      for (const [view,day] of [['hoy'],['semana'],['day','upper'],['day','pierna'],['day','crossfit'],['day','estiramientos'],['day','movilidad'],['day','calentamiento'],['day','casa-20'],['day','agarre'],['historial'],['ajustes'],['reloj']])
        await checkLayout(page,width,view,day);
    await page.evaluate(()=>go('day','pierna'));
    await page.screenshot({path:path.join(shots,'pierna-preview.png'),fullPage:true});
    await page.evaluate(()=>go('day','calentamiento'));
    await page.screenshot({path:path.join(shots,'warmup-preview.png'),fullPage:true});
    const pair = [{id:'curl-biceps',nm:'Curl de bíceps'},{id:'triceps-overhead',nm:'Extensión de tríceps por encima de la cabeza'}];
    for (const width of [320,360,390]) for (const items of [[{id:'sentadilla',nm:'Sentadilla con barra'}], pair]) for (const ph of ['setup','work','rest','log','done']) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(({ph,items})=>{
        const rows=Object.fromEntries(items.map(x=>[x.id,[{kg:90,reps:5},{kg:90,reps:5},{kg:87.5,reps:4}]]));
        S.clock={phase:ph,items,dayId:'upper',target:Object.fromEntries(items.map(x=>[x.id,'10–12'])),sets:3,rest:150,done:ph==='work'?2:3,t0:Date.now()-20000,restEnd:Date.now()+90000,restTotal:150000,paused:false,left:0,runId:Date.now()-300000,ref:Object.fromEntries(items.map(x=>[x.id,{kg:90,setData:[{kg:90,reps:5}]}])),rows,saved:ph==='done',custom:'',typing:false};
        if(ph==='rest')S.clock.done=2;
        save();go('reloj')},{ph,items});
      await page.waitForTimeout(80);
      const L=await page.evaluate(()=>{const els=[...document.querySelectorAll('#app button,#app input,#app select')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});
        const main=document.querySelector('.ck-done,.ck-go');
        return {ov:document.documentElement.scrollWidth>innerWidth,small:els.filter(el=>el.getBoundingClientRect().height<44).map(el=>el.dataset.act||el.tagName),
          main:main?Math.round(main.getBoundingClientRect().bottom):0,nav:Math.round(document.querySelector('#nav').getBoundingClientRect().top),
          broken:/undefined|NaN|\[object Object\]/.test(document.querySelector('#app').innerText)}});
      const where=`reloj ${ph} ${items.length>1?'pair':'single'} at ${width}px`;
      assert.equal(L.ov,false,`${where} overflows`);
      assert.deepEqual(L.small,[],`${where} has small controls`);
      assert.equal(L.broken,false,`${where} prints broken values`);
      if (ph!=='log' && ph!=='done') assert.ok(L.main<L.nav,`${where}: the main button is hidden behind the nav`);
    }
    await ctx.close();

    /* ---------- 10. Sin conexión ---------- */
    const offlineContext=await browser.newContext({serviceWorkers:'allow'});
    const offlinePage=await offlineContext.newPage();
    offlinePage.on('pageerror',e=>errors.push(e.message));
    await offlinePage.goto(URL0);
    await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await offlinePage.waitForTimeout(500);
    await offlinePage.waitForFunction(v=>typeof P!=='undefined'&&P.version===v,VERSION);
    await offlineContext.setOffline(true);
    await offlinePage.reload();
    await offlinePage.waitForFunction(v=>typeof P!=='undefined'&&P.version===v,VERSION);
    assert.match(await offlinePage.locator('#nav').innerText(),/Entrenos/i);
    await offlinePage.goto(URL0+'index.html?d=upper');
    assert.equal(await offlinePage.locator('#top h1').innerText(),'Upper');
    await offlineContext.close();

    assert.deepEqual(errors,[]);
    console.log(`PASS ${VERSION}: 3.x migration, Entrenos, planner, unified Upper and Lower, Ir al reloj, log at the end, supersets, rounds, Registro, layout and offline.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
