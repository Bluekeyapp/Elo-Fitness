// Optional integration suite. Supply PLAYWRIGHT_MODULE if Playwright is external.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve('.');let release='3';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/eloisesportapp/')){res.writeHead(404).end();return;}
    const relative=url.pathname.slice('/eloisesportapp/'.length)||'index.html';
    const path=resolve(root,relative);if(!path.startsWith(root+ '/'.replace('/',process.platform==='win32'?'\\':'/')))throw Error();
    let body=await readFile(path,'utf8');
    body=body.replaceAll('?v=3','?v='+release).replace("const RELEASE = '3'",`const RELEASE = '${release}'`);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'text/plain','Cache-Control':'no-cache'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/eloisesportapp/`;
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();
  await page.goto(url);await page.waitForSelector('.sess-card');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForSelector('.sess-card');
  assert.equal(await page.locator('.sess-card').count(),4);
  await page.evaluate(()=>{
    localStorage.removeItem('gl-state-v1');
    localStorage.setItem('gl-done',JSON.stringify({'w1-a-0':true}));
    localStorage.setItem('gl-history',JSON.stringify([{session:'<img src=x onerror="window.injected=true">'}]));
  });
  await page.reload();await page.waitForSelector('.sess-card');
  assert.match(await page.locator('#storageNotice').innerText(),/récupérée/);
  await page.locator('.sess-card').first().focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.ex-check[aria-pressed=true]').count(),1);
  await page.locator('.ex-info').first().click();
  assert.equal(await page.locator('.ex-info').first().getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.className),'ex-info');
  assert.equal(await page.locator('#exercise-detail-0').isVisible(),true);
  await page.locator('.rest-btn').first().click();
  await page.clock.fastForward(61_000);
  assert.equal(await page.locator('#timerDisplay').innerText(),'Repos terminé');
  await page.locator('#timerCancel').click();assert.equal(await page.locator('#timerBar').isVisible(),false);
  await page.locator('.rest-btn').first().click();
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workout-320.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(let i=1;i<6;i++)await page.locator('.ex-check').nth(i).click();
  assert.equal(await page.locator('#timerBar').isVisible(),false);
  assert.equal(await page.locator('.ex-check[aria-pressed=true]').count(),6);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-pressed')),'true');
  await page.locator('#finishBtn').click();await page.getByText("Retour à l'accueil",{exact:true}).click();
  await page.locator('[data-tab=info]').click();assert.equal(await page.locator('.hist-item').count(),1);
  await page.locator('[data-tab=home]').click();await page.locator('.sess-card').first().click();
  await page.locator('.ex-check').first().click();await page.locator('[data-tab=info]').click();assert.equal(await page.locator('.hist-item').count(),0);
  await page.reload();await page.waitForSelector('.sess-card');assert.match(await page.locator('#homeStats').innerText(),/0\s+Séances terminées/);
  await page.locator('.sess-card').first().click();page.once('dialog',d=>d.accept());await page.locator('#finishBtn').click();
  assert.match(await page.locator('#viewDone h2').innerText(),/partielle/);
  await page.getByText("Retour à l'accueil",{exact:true}).click();await page.locator('[data-tab=info]').click();assert.match(await page.locator('.hist-item').innerText(),/Partielle \(5\/6\)/);
  await page.locator('[data-tab=prog]').click();await page.locator('.prog-more summary').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.prog-more').getAttribute('open'),'');
  assert.equal(await page.locator('.prog-item:visible').count(),6);
  assert.equal(await page.locator('[data-tab=prog]').getAttribute('aria-current'),'page');
  const backup=await page.evaluate(()=>localStorage.getItem('gl-state-v1'));
  await page.locator('.backup-controls summary').click();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter la progression JSON',exact:true}).click();
  const download=await downloadEvent;assert.equal(download.suggestedFilename(),'glutelab-progression.json');
  const stream=await download.createReadStream();let downloaded='';for await(const chunk of stream)downloaded+=chunk;
  assert.deepEqual(JSON.parse(downloaded),JSON.parse(backup));
  page.once('dialog',d=>d.dismiss());await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  assert.equal(await page.evaluate(()=>localStorage.getItem('gl-state-v1')),backup);
  await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await page.waitForFunction(()=>document.getElementById('storageNotice').textContent.includes('Import refusé'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('gl-state-v1')),backup);
  const full=await page.evaluate(async()=>{
    const {catalog,emptyState}=await import('./js/state.js?v=3');const s=emptyState();s.week=12;
    for(const [key,session] of Object.entries(catalog))s.sessions[key]={checked:session.ex.map(()=>true),completedAt:null,endedAt:null};
    s.legacy={'gl-history':'<img src=x onerror="window.injected=true">'};return JSON.stringify(s);
  });
  page.once('dialog',d=>d.accept());await page.locator('#importFile').setInputFiles({name:'full.json',mimeType:'application/json',buffer:Buffer.from(full)});
  await page.waitForFunction(()=>document.getElementById('homeFocusTitle').textContent==='Programme terminé !');
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  await page.locator('[data-tab=info]').click();assert.equal(await page.locator('.hist-item').count(),48);
  await page.locator('[data-tab=home]').click();await page.locator('#weekStrip [aria-label="Semaine précédente"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Semaine précédente');
  const saved=await page.evaluate(()=>localStorage.getItem('gl-state-v1'));
  // Real waiting-worker activation and reload, served under a Pages-style subpath.
  release='4';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.waitForFunction(()=>!document.getElementById('updateButton').hidden);
  await Promise.all([page.waitForNavigation(),page.locator('#updateButton').click()]);
  await page.waitForSelector('.sess-card');assert.equal(await page.evaluate(()=>localStorage.getItem('gl-state-v1')),saved);
  await context.setOffline(true);await page.reload();await page.waitForSelector('.sess-card');
  assert.match(await page.locator('#homeFocusTitle').innerText(),/Programme terminé/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  await context.setOffline(false);
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: keyboard/focus, migration, finish/undo/reload, timer expiry/cancel, partial history, goals, export/import rejection/cancel/safety, program completion, manual weeks, real SW update, offline reload, 320px/390px/desktop layouts.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
