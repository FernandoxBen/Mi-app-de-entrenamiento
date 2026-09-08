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
    const program = await page.evaluate(()=>{
      const get=(day,id)=>flatEx(dayById(day)).find(e=>e.id===id);
      return {
        upperA:{landmine:get('upper-a','landmine').sets,curl:get('upper-a','curl-biceps').sets,triceps:get('upper-a','triceps-overhead').sets},
        leg:{squat:[get('pierna','sentadilla').sets,get('pierna','sentadilla').reps],bulgarian:[get('pierna','bulgara').sets,get('pierna','bulgara').reps],nordic:get('pierna','nordico').sets},
        upperB:{pulldown:!!get('upper-b','jalon'),hammer:get('upper-b','curl-martillo').sets,triceps:get('upper-b','triceps-polea').sets},
        conditioning:{hip:get('crossfit','hip-thrust').sets,step:get('crossfit','step-up').sets},
        guide:Object.keys(EX_GUIDE).length
      };
    });
    assert.deepEqual(program,{upperA:{landmine:3,curl:3,triceps:3},leg:{squat:[3,'4–6'],bulgarian:[2,'6–8/pierna'],nordic:2},upperB:{pulldown:false,hammer:3,triceps:3},conditioning:{hip:2,step:2},guide:21});
    const warmup=await page.evaluate(()=>P.warmup.groups.flatMap(g=>g.items.map(x=>x.n)));
    assert.deepEqual(warmup,['Cat-Cow',"World’s Greatest Stretch",'Quadruped Thoracic Rotation','Scapular Wall Slide','Scapular Push-up','Dead Bug','Glute Bridge','Knee-to-Wall Ankle Dorsiflexion']);
    assert.equal(warmup.some(x=>/bici|band|banda|pasos laterales/i.test(x)),false);
    assert.equal(await page.evaluate(()=>P.warmup.groups.concat([P.warmup.optional]).flatMap(g=>g.items).every(x=>x.es&&x.how&&x.d)),true);
    assert.deepEqual(await page.evaluate(()=>P.warmup.optional.items.map(x=>x.n)),['Assisted Dead Hang']);
    // Old copies and corrupt new fields receive safe defaults.
    assert.equal(await page.evaluate(()=>{const old={plans:[],warmups:{bad:null}};normalizePlanning(old);return Object.keys(old.plans).length+Object.keys(old.warmups).length;}),0);
    await page.evaluate(()=>go('hoy'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    // A superset starts rest after the pair, not after its first exercise.
    await page.evaluate(()=>{S.active=null;save();go('day','upper-a')});
    await page.locator('[data-act="start"]').click();
    assert.ok(await page.locator('.exguide').count()>=6);
    await page.locator('[data-act="set"][data-k^="curl-biceps|"]').first().click();
    assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('on')),false);
    await page.locator('[data-act="set"][data-k^="triceps-overhead|"]').first().click();
    assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('on')),true);
    await page.locator('[data-act="skip"]').click();
    await page.evaluate(()=>{S.active=null;save()});
    async function checkLayout(width, view, day){
      await page.setViewportSize({width,height:844});
      await page.evaluate(({view,day})=>go(view,day),{view,day});
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout(250);
      const layout=await page.evaluate(()=>{
        const overflow=document.documentElement.scrollWidth>window.innerWidth;
        const els=[...document.querySelectorAll('button,select,input,a[href],summary')].filter(el=>{
          const s=getComputedStyle(el),r=el.getBoundingClientRect();
          return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&!el.matches('.skip')&&!el.closest('#nav')&&!el.closest('.sheet:not(.on)');
        });
        const overlaps=[];
        for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
          const a=els[i],b=els[j]; if(a.contains(b)||b.contains(a))continue;
          const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
          if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)overlaps.push([a.outerHTML.slice(0,70),b.outerHTML.slice(0,70)]);
        }
        const small=els.filter(el=>el.matches('button,a.btn,summary')&&el.getBoundingClientRect().height<36).map(el=>el.outerHTML.slice(0,90));
        const misalignedGroups=[...document.querySelectorAll('.btnrow,.readiness,.set-dots,.sheet.on .btns')].flatMap(group=>{
          const controls=[...group.children].filter(el=>el.matches('button,a.btn')).map(el=>el.getBoundingClientRect());
          if(controls.length<2)return [];
          const sameRow=controls.every(r=>Math.abs(r.top-controls[0].top)<=2);
          const sameHeight=controls.every(r=>Math.abs(r.height-controls[0].height)<=2);
          return sameRow&&sameHeight?[]:[group.className];
        });
        return {overflow,overlaps,small,misalignedGroups};
      });
      assert.equal(layout.overflow,false,`${view}/${day||''} overflows at ${width}px`);
      assert.deepEqual(layout.overlaps,[],`${view}/${day||''} has overlapping controls at ${width}px`);
      assert.deepEqual(layout.small,[],`${view}/${day||''} has controls under 36px at ${width}px`);
      assert.deepEqual(layout.misalignedGroups,[],`${view}/${day||''} has misaligned button groups at ${width}px`);
    }
    for(const width of [320,390,768]) for(const [view,day] of [['hoy'],['semana'],['day','upper-a'],['day','pierna'],['day','upper-b'],['day','crossfit'],['day','calentamiento'],['historial'],['ajustes']]) await checkLayout(width,view,day);
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>go('day','calentamiento'));
      const controls=await page.locator('.warm-check').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,w:r.width,h:r.height}}));
      assert.ok(controls.length>=9);
      assert.ok(controls.every(x=>x.x===controls[0].x&&x.w===44&&x.h===44),`warm-up controls are misaligned at ${width}px`);
      const cards=await page.locator('.witem').evaluateAll(els=>els.map(el=>{
        const c=el.getBoundingClientRect(),n=el.querySelector('.wname').getBoundingClientRect();
        return {w:Math.round(c.width),nameW:Math.round(n.width),guide:!!el.querySelector('.warm-how'),marks:el.querySelectorAll('.warm-check').length};
      }));
      assert.ok(cards.every(c=>c.w===cards[0].w&&c.guide&&c.marks===1),`warm-up cards are inconsistent at ${width}px`);
      assert.ok(cards.every(c=>c.nameW>=c.w*0.35),`warm-up names are squeezed at ${width}px`);
      if(width===320)await page.screenshot({path:path.join(root,'tests','warmup-320-preview.png'),fullPage:true});
      await page.evaluate(()=>go('day','upper-a'));
      const series=await page.locator('.track').first().evaluate(el=>{
        const dots=[...el.querySelectorAll('.dot')].map(x=>x.getBoundingClientRect());
        const weight=el.querySelector('.wgt').getBoundingClientRect();
        return {gaps:dots.slice(1).map((x,i)=>Math.round(x.left-dots[i].right)),dy:Math.round(Math.abs(dots[0].y-weight.y))};
      });
      assert.ok(series.gaps.every(g=>g===(width<=360?6:8)),`series buttons have uneven gaps at ${width}px`);
      assert.ok(series.dy<=2,`weight control is not aligned with series buttons at ${width}px`);
    }
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>go('historial'));
      const chips=await page.locator('.liftseg button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}));
      assert.ok(chips.length>=6);
      assert.ok(chips.every(c=>c.w===chips[0].w&&c.h===chips[0].h&&c.h>=44),`lift chips are uneven at ${width}px`);
      const cols=[...new Set(chips.map(c=>c.x))],rows=[...new Set(chips.map(c=>c.y))];
      assert.equal(chips.length,cols.length*rows.length,`lift chips do not fill a grid at ${width}px`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>go('day','movilidad'));
    await page.evaluate(()=>document.querySelectorAll('.sec.fold').forEach(el=>el.click()));
    const miniRows=await page.locator('.mini .m').evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect(),n=el.querySelector('b').getBoundingClientRect();
      return {w:Math.round(r.width),nameW:Math.round(n.width)};
    }));
    assert.ok(miniRows.length>0&&miniRows.every(n=>n.nameW>=n.w*0.5),'mini rows squeeze the movement name');
    await page.evaluate(()=>{S.prs={'press-banca':62,'roto':null,'sentadilla':{kg:'100',nm:'Sentadilla'}};save()});
    await page.reload();
    const prs=await page.evaluate(()=>{go('historial');return {keys:Object.keys(S.prs).sort(),rows:document.querySelectorAll('.prow').length,text:[...document.querySelectorAll('.prow')].map(x=>x.textContent).join(' ')}});
    assert.deepEqual(prs.keys,['press-banca','sentadilla']);
    assert.equal(prs.rows,2);
    assert.equal(/undefined|Invalid Date|NaN/.test(prs.text),false);
    await page.evaluate(()=>{S.prs={};save()});
    // Editing an exercise happens in the ⋯ sheet, not in the row.
    async function openExMenu(nameRe){
      await page.locator('.ex').filter({hasText:nameRe}).first().locator('[data-act="ex-menu"]').click();
      await page.locator('#exsheet.on').waitFor();
    }
    async function closeExMenu(){
      await page.locator('#exsheet [data-act="ex-menu-close"]').first().click();
      await page.waitForFunction(()=>!document.querySelector('#exsheet').classList.contains('on'));
    }
    // Flexible session: draft swap, independent history, preload, favorite, add, skip and reorder.
    await page.evaluate(()=>{
      const ts=Date.now()-864e5;
      S.active=null;S.drafts={};S.favorites={};S.recents=[];
      S.settings.restStrength=120;S.settings.restStandard=60;
      S.history=[{id:'seed',dayId:'upper-a',ts,dur:2400000,vol:2160,note:'',entries:[{id:'press-mancuernas',nm:'Press con mancuernas',sets:3,reps:'8 / 8 / 7',kg:30,setData:[{kg:30,reps:8},{kg:30,reps:8},{kg:30,reps:7}],ts}]}];save();go('day','upper-a');
    });
    // The row itself carries no editing controls.
    assert.equal(await page.locator('.ex select').count(),0);
    assert.equal(await page.locator('.ex [data-act="move-ex"], .ex [data-act="skip-ex"], .ex [data-act="fav"], .ex [data-act="repslog"]').count(),0);
    await openExMenu(/Press de banca/);
    await page.locator('#exsheet select.ex-select').selectOption('press-mancuernas');
    await closeExMenu();
    assert.equal(await page.evaluate(()=>S.drafts['upper-a']['press-banca|Press de banca']),'press-mancuernas');
    await page.locator('[data-act="start"]').click();
    await checkLayout(320,'day','upper-a');
    await page.setViewportSize({width:390,height:844});
    const liveBench=page.locator('.ex').filter({hasText:'Press con mancuernas'}).first();
    assert.equal(await liveBench.locator('[data-act="kg"]').inputValue(),'30');
    assert.match(await liveBench.textContent(),/8 \/ 8 \/ 7/);
    await openExMenu(/Press con mancuernas/);
    await page.locator('#exsheet [data-act="fav"]').click();
    assert.equal(await page.evaluate(()=>S.favorites['press-mancuernas']),true);
    await page.locator('#exsheet [data-act="repslog"]').fill('9, 8, 8');
    // The first exercise cannot move up.
    assert.equal(await page.locator('#exsheet [data-act="move-ex"][data-d="-1"]').isDisabled(),true);
    await closeExMenu();
    await liveBench.locator('[data-act="set"]').first().click();
    assert.deepEqual(await page.evaluate(()=>({open:document.querySelector('#sheet').classList.contains('on'),total:RT.total})),{open:true,total:120});
    await page.locator('[data-act="rest30"]').click();
    assert.equal(await page.evaluate(()=>RT.total),150);
    await page.locator('[data-act="timer-pause"]').click();
    assert.equal(await page.locator('[data-act="timer-pause"]').textContent(),'Reanudar');
    await page.locator('[data-act="timer-pause"]').click();
    await page.locator('[data-act="skip"]').click();
    const secondUid=await page.evaluate(()=>S.active.exercises[1]._uid);
    await page.locator(`[data-act="ex-menu"][data-slot="${secondUid}"]`).click();
    await page.locator('#exsheet [data-act="skip-ex"]').click();
    await closeExMenu();
    assert.equal(await page.evaluate(uid=>S.active.exercises.find(x=>x._uid===uid).skipped,secondUid),true);
    await page.locator('[data-act="add-ex"]').selectOption('laterales-maquina');
    const addedUid=await page.evaluate(()=>S.active.exercises.at(-1)._uid);
    await page.locator(`[data-act="ex-menu"][data-slot="${addedUid}"]`).click();
    assert.equal(await page.locator('#exsheet [data-act="move-ex"][data-d="1"]').isDisabled(),true);
    await page.locator('#exsheet [data-act="move-ex"][data-d="-1"]').click();
    await page.locator('#exsheet [data-act="repslog"]').fill('12');
    await closeExMenu();
    const added=page.locator('.ex').filter({hasText:'Máquina de deltoide lateral'}).first();
    await added.locator('[data-act="kg"]').fill('8');
    await added.locator('[data-act="set"]').first().click();
    await page.locator('[data-act="skip"]').click();
    await page.locator('[data-act="manual-timer"]').click();
    await page.evaluate(()=>go('semana'));
    assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('on')),true);
    await page.evaluate(()=>go('day','upper-a'));
    await page.locator('[data-act="timer-mode"][data-mode="up"]').click();
    await page.waitForTimeout(350);
    await page.locator('[data-act="timer-pause"]').click();
    assert.deepEqual(await page.evaluate(()=>({mode:RT.mode,running:RT.running,visible:document.querySelector('#sheet').classList.contains('on')})),{mode:'up',running:false,visible:true});
    await page.locator('[data-act="skip"]').click();
    assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('on')),false);
    await page.screenshot({path:path.join(root,'tests','flexible-session-preview.png'),fullPage:true});
    await page.locator('[data-act="finish"]').click();
    const flexible=await page.evaluate(()=>({ids:S.history[0].entries.map(e=>e.id),press:S.history[0].entries.find(e=>e.id==='press-mancuernas'),template:flatEx(dayById('upper-a'))[0].id,recents:S.recents.slice()}));
    assert.ok(flexible.ids.includes('press-mancuernas')&&flexible.ids.includes('laterales-maquina'));
    assert.equal(flexible.press.reps,'9');
    assert.equal(flexible.template,'press-banca');
    assert.ok(flexible.recents.includes('press-mancuernas'));
    await page.evaluate(()=>go('day','upper-a'));
    await openExMenu(/Press con mancuernas/);
    await page.locator('#exsheet select.ex-select').selectOption('press-banca');
    await closeExMenu();
    assert.equal(await page.evaluate(()=>S.drafts['upper-a']['press-banca|Press de banca']),'press-banca');
    await page.evaluate(()=>go('ajustes'));
    await page.locator('[data-setting="restStrength"]').fill('135');await page.locator('[data-setting="restStrength"]').blur();
    await page.locator('[data-setting="restStandard"]').fill('75');await page.locator('[data-setting="restStandard"]').blur();
    await page.reload();
    assert.deepEqual(await page.evaluate(()=>[S.settings.restStrength,S.settings.restStandard]),[135,75]);
    // The session row stays legible and thin: name, guide, series, weight and ⋯.
    await page.evaluate(()=>{S.active=null;save();go('day','upper-a');startSession('upper-a')});
    for(const width of [320,360,390]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout(200);
      const rows=await page.locator('.ex').evaluateAll(els=>els.map(ex=>{
        const name=ex.querySelector('.exname'),edit=ex.querySelector('.ex-edit'),r=edit?edit.getBoundingClientRect():null;
        return {controls:ex.querySelectorAll('button,select,input,summary').length,
          cut:name?name.scrollWidth>name.clientWidth+1:false,
          edit:r?[Math.round(r.width),Math.round(r.height)]:null};
      }));
      assert.ok(rows.length>=6);
      assert.ok(rows.every(r=>r.controls<=7),`too many controls per exercise at ${width}px: ${Math.max(...rows.map(r=>r.controls))}`);
      assert.ok(rows.every(r=>!r.cut),`the exercise name is cut at ${width}px`);
      assert.ok(rows.every(r=>r.edit&&r.edit[0]===44&&r.edit[1]===44),`the ⋯ button is not 44px at ${width}px`);
    }
    // The sheet carries the editing controls, fits the screen and keeps 44px targets.
    await page.setViewportSize({width:320,height:844});
    await openExMenu(/Press de banca/);
    const sheet=await page.evaluate(()=>{
      const s=document.querySelector('#exsheet'),r=s.getBoundingClientRect();
      return {acts:[...s.querySelectorAll('[data-act]')].map(el=>el.dataset.act),
        width:Math.round(r.width),
        small:[...s.querySelectorAll('button,select,input')].filter(el=>el.getBoundingClientRect().height<44).map(el=>(el.dataset.act||el.tagName)+':'+Math.round(el.getBoundingClientRect().height))};
    });
    assert.ok(['swap-ex','repslog','fav','skip-ex','move-ex'].every(a=>sheet.acts.includes(a)),JSON.stringify(sheet.acts));
    assert.equal(sheet.width,320);
    assert.deepEqual(sheet.small,[],JSON.stringify(sheet));
    await closeExMenu();
    await page.evaluate(()=>{S.active=null;save()});
    assert.deepEqual(errors,[]);
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>go('hoy'));
    await page.screenshot({path:path.join(root,'tests','mobile-preview.png'),fullPage:true});
    await page.evaluate(()=>go('semana'));
    await page.screenshot({path:path.join(root,'tests','planner-preview.png'),fullPage:true});
    await page.evaluate(()=>go('day','calentamiento'));
    await page.screenshot({path:path.join(root,'tests','warmup-preview.png'),fullPage:true});
    for(const id of ['upper-a','pierna','upper-b','crossfit']){
      await page.evaluate(id=>go('day',id),id);
      await page.screenshot({path:path.join(root,'tests',`${id}-preview.png`),fullPage:true});
    }
    await page.setViewportSize({width:320,height:844});
    await page.evaluate(()=>go('day','pierna'));
    const nordic=page.locator('.ex').filter({hasText:'Curl nórdico'}).first();
    await nordic.locator('summary').click();
    assert.match(await nordic.textContent(),/fija bien los tobillos/);
    assert.match(await nordic.textContent(),/Curl femoral sentado/);
    await page.screenshot({path:path.join(root,'tests','nordic-guide-preview.png'),fullPage:true});
    await page.evaluate(()=>go('day','crossfit'));
    const step=page.locator('.ex').filter({hasText:'Step-up al cajón'}).first();
    await step.locator('summary').click();
    assert.match(await step.textContent(),/todo el pie/);
    assert.match(await step.textContent(),/zancada atrás/);
    await page.screenshot({path:path.join(root,'tests','step-up-guide-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: migration, planning, flexible exercises, independent history, configurable timers, guides and responsive controls.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
