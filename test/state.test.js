import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, catalog, toggleExercise, finishWorkout, completedKeys, historyEntries, weekIsDone, programIsDone, phaseForWeek, clampWeek, validateState } from '../js/state.js';
import { migrateLegacy, createStorage, parseImport, STORAGE_KEY } from '../js/storage.js';
const stamp = '2026-10-13T12:00:00.000Z';
const complete = (state, key) => catalog[key].ex.reduce((s, _, i) => toggleExercise(s, key, i, stamp), state);
function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('checking all, explicit finish, repeated finish and reload agree', () => {
  let state = complete(emptyState(), 'w1-a');
  assert.equal(completedKeys(state).length, 1);
  assert.equal(historyEntries(state).length, 1);
  const finished = finishWorkout(state, 'w1-a', stamp);
  assert.deepEqual(finished, state);
  assert.deepEqual(finishWorkout(finished, 'w1-a'), finished);
  const disk = memory(), store = createStorage(() => disk); store.load(); store.save(finished);
  assert.deepEqual(createStorage(() => disk).load().state, finished);
});
test('partial and empty finish never fill unchecked exercises or count as complete', () => {
  assert.deepEqual(finishWorkout(emptyState(), 'w1-a'), emptyState());
  let state = toggleExercise(emptyState(), 'w1-a', 0, stamp);
  state = finishWorkout(state, 'w1-a', stamp);
  assert.equal(completedKeys(state).length, 0);
  assert.equal(state.sessions['w1-a'].checked.filter(Boolean).length, 1);
  assert.equal(historyEntries(state)[0].complete, false);
  assert.deepEqual(finishWorkout(state, 'w1-a'), state);
  assert.deepEqual(parseImport(JSON.stringify(state)), state);
});
test('undo retracts completion and history, recompletion records exactly once', () => {
  let state = complete(emptyState(), 'w1-a');
  state = toggleExercise(state, 'w1-a', 0, stamp);
  assert.equal(completedKeys(state).length, 0); assert.equal(historyEntries(state).length, 0);
  assert.equal(parseImport(JSON.stringify(state)).sessions['w1-a'].completedAt, null);
  state = toggleExercise(state, 'w1-a', 0, stamp);
  assert.equal(completedKeys(state).length, 1); assert.equal(historyEntries(state).length, 1);
});
test('all week/phase boundaries and all 48 sessions, independent manual navigation', () => {
  assert.deepEqual([1,4,5,8,9,12].map(phaseForWeek), [0,0,1,1,2,2]);
  assert.equal(clampWeek(-2),1); assert.equal(clampWeek(14),12); assert.equal(clampWeek(2.8),2);
  let state=emptyState();
  for(const key of Object.keys(catalog)) state=complete(state,key);
  assert.equal(completedKeys(state).length,48); assert.ok(programIsDone(state));
  for(let week=1;week<=12;week++) assert.ok(weekIsDone(state,week));
  state=toggleExercise(state,'w4-a',0,stamp);
  assert.equal(weekIsDone(state,4),false); assert.equal(weekIsDone(state,5),true); assert.equal(programIsDone(state),false);
});
test('legacy completed, partial, inconsistent and orphan history preserved without invented checks', () => {
  const raw={ 'gl-week':'5', 'gl-done':JSON.stringify(Object.fromEntries(catalog['w1-a'].ex.map((_,i)=>['w1-a-'+i,true]).concat([['w1-b-0',true]]))),
    'gl-sessions':JSON.stringify({'w1-a':{date:stamp},'w1-b':{date:stamp}}),
    'gl-history':JSON.stringify([{key:'w1-a',session:'<img src=x onerror=alert(1)>',date:'13/10/2026'},{key:'w2-a'}]) };
  const {state,warnings}=migrateLegacy(raw);
  assert.equal(state.week,5); assert.equal(completedKeys(state).length,1); assert.equal(historyEntries(state).length,1);
  assert.equal(state.sessions['w1-b'].checked.filter(Boolean).length,1); assert.deepEqual(state.legacy,raw);
  assert.ok(warnings.length); assert.equal(historyEntries(state)[0].session,catalog['w1-a'].title);
  const disk=memory(raw), store=createStorage(()=>disk); store.load();
  for(const [key,value] of Object.entries(raw)) assert.equal(disk.getItem(key),value);
});
test('malformed legacy JSON and wrong types recover visibly; valid other keys survive', () => {
  for(const bad of ['{','null','[]','true','"text"']) {
    const {state,warnings}=migrateLegacy({'gl-done':bad,'gl-week':'8'});
    assert.equal(state.week,8); assert.ok(warnings.length); assert.equal(state.legacy['gl-done'],bad);
  }
});
test('malformed current storage is protected until explicit validated replacement', () => {
  for(const raw of ['{','null',JSON.stringify({...emptyState(),version:99})]) {
    const disk=memory({[STORAGE_KEY]:raw}),store=createStorage(()=>disk);
    assert.ok(store.load().warnings.length); assert.throws(()=>store.save(emptyState())); assert.equal(disk.getItem(STORAGE_KEY),raw);
    store.save(emptyState(),{replace:true}); assert.deepEqual(JSON.parse(disk.getItem(STORAGE_KEY)),emptyState());
  }
});
test('read/write denial and quota failure are visible and do not delete originals', () => {
  const denied=createStorage(()=>{throw new Error('Denied');}); assert.ok(denied.load().warnings.length); assert.throws(()=>denied.save(emptyState()));
  const disk=memory({'gl-week':'4'}); disk.setItem=()=>{throw Error('Quota');};
  const store=createStorage(()=>disk),result=store.load(); assert.equal(result.state.week,4);assert.ok(result.warnings.length);assert.throws(()=>store.save(result.state));assert.equal(disk.getItem('gl-week'),'4');
});
test('strict import rejects unknown fields, invalid dates, keys, booleans and versions', () => {
  const good=complete(emptyState(),'w1-a'); assert.deepEqual(parseImport(JSON.stringify(good)),good);
  for(const change of [s=>s.version=9,s=>s.week=13,s=>s.sessions['w1-a'].checked[0]='true',s=>s.sessions['w1-a'].checked=[],s=>s.sessions['w1-a'].completedAt='<script>',s=>s.title='injected',s=>s.sessions.bad=s.sessions['w1-a']]) {
    const value=structuredClone(good);change(value); assert.throws(()=>validateState(value));
  }
  assert.throws(()=>parseImport('x'.repeat(5_000_001)));
});
test('a stale tab cannot overwrite changes from another tab', () => {
  const disk=memory(),a=createStorage(()=>disk),b=createStorage(()=>disk);a.load();b.load();
  a.save(complete(emptyState(),'w1-a'));assert.throws(()=>b.save(emptyState()),/autre onglet/);assert.equal(completedKeys(a.load().state).length,1);
});
