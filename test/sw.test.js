import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const scope='https://example.org/eloisesportapp/';
const prefix=`glutelab-${encodeURIComponent(scope)}-`;
function harness(initial=[]) {
  const handlers={},stores=new Map(initial.map(name=>[name,new Map()]));let skipped=0,claimed=0;
  let network=async()=>new Response('asset',{headers:{'content-type':'text/html'}});
  const key=r=>typeof r==='string'?r:r.url;
  const caches={keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),open:async n=>{
    if(!stores.has(n))stores.set(n,new Map());const entries=stores.get(n);
    return {put:async(r,v)=>entries.set(key(r),v.clone()),match:async r=>entries.get(key(r))?.clone()};
  }};
  vm.runInNewContext(source,{self:{registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>skipped++,clients:{claim:async()=>claimed++}},caches,
    fetch:(...args)=>network(...args),URL,Request,Response,AbortController,setTimeout,clearTimeout});
  return {stores,handlers,caches,setNetwork:f=>network=f,get skipped(){return skipped;},get claimed(){return claimed;},
    async lifecycle(name){let work;handlers[name]({waitUntil:p=>work=p});await work;},
    async request(path,{mode='cors',method='GET'}={}){let work;handlers.fetch({request:{url:new URL(path,scope).href,mode,method},respondWith:p=>work=p});return work===undefined?null:await work;}};
}
test('install precaches full shell, waits for explicit update, scopes cleanup',async()=>{
  const h=harness(['unrelated-cache',prefix+'2','glutelab-v2','glutelab-other-app-2']);
  await h.lifecycle('install');assert.equal(h.skipped,0);
  assert.equal(h.stores.get(prefix+'3').size,10);
  h.handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(h.skipped,1);
  await h.lifecycle('activate');assert.ok(h.stores.has('unrelated-cache'));assert.ok(h.stores.has('glutelab-other-app-2'));
  assert.equal(h.stores.has(prefix+'2'),false);assert.equal(h.stores.has('glutelab-v2'),false);assert.equal(h.claimed,1);
});
test('legacy cache-first worker upgrade escapes without requiring missing update UI',async()=>{
  const h=harness(['glutelab-v2']);await h.lifecycle('install');assert.equal(h.skipped,1);
});
test('navigation refreshes HTML online and falls back offline only for navigation',async()=>{
  const h=harness();await h.lifecycle('install');
  const fresh='fresh <script src="./js/ui.js?v=3"></script>';
  h.setNetwork(async()=>new Response(fresh,{headers:{'content-type':'text/html'}}));
  assert.equal(await (await h.request('./',{mode:'navigate'})).text(),fresh);
  h.setNetwork(async()=>{throw Error('offline');});
  assert.equal(await (await h.request('./',{mode:'navigate'})).text(),fresh);
  assert.equal(await h.request('missing.js'),null);assert.equal(await h.request('https://other.org/a'),null);
  assert.equal(await h.request('./',{method:'POST'}),null);
  h.stores.get(prefix+'3').delete(scope+'js/ui.js?v=3');
  await assert.rejects(h.request('js/ui.js?v=3'),/offline/);
});
test('failed/opaque assets are never cached and a failed install retains old cache',async()=>{
  const h=harness([prefix+'2']);h.setNetwork(async()=>new Response('error',{status:500}));
  await assert.rejects(h.lifecycle('install'));assert.ok(h.stores.has(prefix+'2'));assert.equal(h.skipped,0);
  assert.equal((await h.request('js/ui.js?v=3')).status,500);assert.equal(h.stores.get(prefix+'3').size,0);
  h.setNetwork(async()=>({ok:true,type:'opaque',redirected:false}));
  await h.request('js/ui.js?v=3');assert.equal(h.stores.get(prefix+'3').size,0);
});
test('asset cache is immutable within a release and navigation errors do not poison HTML',async()=>{
  const h=harness();await h.lifecycle('install');let calls=0;
  h.setNetwork(async()=>{calls++;return new Response('bad',{status:503});});
  await h.request('styles.css?v=3');assert.equal(calls,0);
  assert.equal(await (await h.request('./',{mode:'navigate'})).text(),'asset');
  assert.equal(await (await h.caches.open(prefix+'3')).match(scope+'index.html').then(r=>r.text()),'asset');
});
test('newer HTML is served online without replacing the older coherent offline shell',async()=>{
  const h=harness();await h.lifecycle('install');
  h.setNetwork(async()=>new Response('<script src="./js/ui.js?v=4"></script>',{headers:{'content-type':'text/html'}}));
  assert.match(await (await h.request('./',{mode:'navigate'})).text(),/v=4/);
  h.setNetwork(async()=>{throw Error('offline');});
  assert.equal(await (await h.request('./',{mode:'navigate'})).text(),'asset');
});
