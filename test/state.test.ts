import { test, expect } from 'vitest';
import {
  emptyState, catalog, toggleExercise, finishWorkout, completedKeys, historyEntries, weekIsDone, programIsDone,
  phaseForWeek, clampWeek, validateState, setLoad, previousLoad, suggestedSession, type AppState,
} from '../src/lib/state';
import { migrateLegacy, createStorage, parseImport, STORAGE_KEY, V1_KEY } from '../src/lib/storage';

const stamp = '2026-10-13T12:00:00.000Z';
const complete = (state: AppState, key: string) => catalog[key].ex.reduce((s, _, i) => toggleExercise(s, key, i, stamp), state);
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
}

// ── Rules carried over from the original app ──

test('checking all, explicit finish, repeated finish and reload agree', () => {
  const state = complete(emptyState(), 'w1-a');
  expect(completedKeys(state)).toHaveLength(1);
  expect(historyEntries(state)).toHaveLength(1);
  const finished = finishWorkout(state, 'w1-a', stamp);
  expect(finished).toEqual(state);
  expect(finishWorkout(finished, 'w1-a')).toEqual(finished);
  const disk = memory(), store = createStorage(() => disk); store.load(); store.save(finished);
  expect(createStorage(() => disk).load().state).toEqual(finished);
});

test('partial and empty finish never fill unchecked exercises or count as complete', () => {
  expect(finishWorkout(emptyState(), 'w1-a')).toEqual(emptyState());
  let state = toggleExercise(emptyState(), 'w1-a', 0, stamp);
  state = finishWorkout(state, 'w1-a', stamp);
  expect(completedKeys(state)).toHaveLength(0);
  expect(state.sessions['w1-a'].checked.filter(Boolean)).toHaveLength(1);
  expect(historyEntries(state)[0].complete).toBe(false);
  expect(finishWorkout(state, 'w1-a')).toEqual(state);
  expect(parseImport(JSON.stringify(state))).toEqual(state);
});

test('undo retracts completion and history, recompletion records exactly once', () => {
  let state = complete(emptyState(), 'w1-a');
  state = toggleExercise(state, 'w1-a', 0, stamp);
  expect(completedKeys(state)).toHaveLength(0); expect(historyEntries(state)).toHaveLength(0);
  expect(parseImport(JSON.stringify(state)).sessions['w1-a'].completedAt).toBeNull();
  state = toggleExercise(state, 'w1-a', 0, stamp);
  expect(completedKeys(state)).toHaveLength(1); expect(historyEntries(state)).toHaveLength(1);
});

test('all week/phase boundaries and all 48 sessions, independent manual navigation', () => {
  expect([1, 4, 5, 8, 9, 12].map(phaseForWeek)).toEqual([0, 0, 1, 1, 2, 2]);
  expect([clampWeek(-2), clampWeek(14), clampWeek(2.8)]).toEqual([1, 12, 2]);
  let state = emptyState();
  for (const key of Object.keys(catalog)) state = complete(state, key);
  expect(completedKeys(state)).toHaveLength(48); expect(programIsDone(state)).toBe(true);
  for (let week = 1; week <= 12; week++) expect(weekIsDone(state, week)).toBe(true);
  state = toggleExercise(state, 'w4-a', 0, stamp);
  expect(weekIsDone(state, 4)).toBe(false); expect(weekIsDone(state, 5)).toBe(true); expect(programIsDone(state)).toBe(false);
});

test('legacy completed, partial, inconsistent and orphan history preserved without invented checks', () => {
  const raw = {
    'gl-week': '5',
    'gl-done': JSON.stringify(Object.fromEntries(catalog['w1-a'].ex.map((_, i) => ['w1-a-' + i, true]).concat([['w1-b-0', true]]))),
    'gl-sessions': JSON.stringify({ 'w1-a': { date: stamp }, 'w1-b': { date: stamp } }),
    'gl-history': JSON.stringify([{ key: 'w1-a', session: '<img src=x onerror=alert(1)>', date: '13/10/2026' }, { key: 'w2-a' }]),
  };
  const { state, warnings } = migrateLegacy(raw);
  expect(state.week).toBe(5); expect(completedKeys(state)).toHaveLength(1); expect(historyEntries(state)).toHaveLength(1);
  expect(state.sessions['w1-b'].checked.filter(Boolean)).toHaveLength(1); expect(state.legacy).toEqual(raw);
  expect(warnings.length).toBeGreaterThan(0); expect(historyEntries(state)[0].session).toBe(catalog['w1-a'].title);
  const disk = memory(raw); createStorage(() => disk).load();
  for (const [k, v] of Object.entries(raw)) expect(disk.getItem(k)).toBe(v);
});

test('malformed legacy JSON and wrong types recover visibly; valid other keys survive', () => {
  for (const bad of ['{', 'null', '[]', 'true', '"text"']) {
    const { state, warnings } = migrateLegacy({ 'gl-done': bad, 'gl-week': '8' });
    expect(state.week).toBe(8); expect(warnings.length).toBeGreaterThan(0); expect(state.legacy['gl-done']).toBe(bad);
  }
});

test('malformed current storage is protected until explicit validated replacement', () => {
  for (const raw of ['{', 'null', JSON.stringify({ ...emptyState(), version: 99 })]) {
    const disk = memory({ [STORAGE_KEY]: raw }), store = createStorage(() => disk);
    expect(store.load().warnings.length).toBeGreaterThan(0);
    expect(() => store.save(emptyState())).toThrow(); expect(disk.getItem(STORAGE_KEY)).toBe(raw);
    store.save(emptyState(), { replace: true }); expect(JSON.parse(disk.getItem(STORAGE_KEY)!)).toEqual(emptyState());
  }
});

test('read/write denial and quota failure are visible and do not delete originals', () => {
  const denied = createStorage(() => { throw new Error('Denied'); });
  expect(denied.load().warnings.length).toBeGreaterThan(0); expect(() => denied.save(emptyState())).toThrow();
  const disk = memory({ 'gl-week': '4' }); disk.setItem = () => { throw Error('Quota'); };
  const store = createStorage(() => disk), result = store.load();
  expect(result.state.week).toBe(4); expect(result.warnings.length).toBeGreaterThan(0);
  expect(() => store.save(result.state)).toThrow(); expect(disk.getItem('gl-week')).toBe('4');
});

test('strict import rejects unknown fields, invalid dates, keys, booleans, loads and versions', () => {
  const good = setLoad(complete(emptyState(), 'w1-a'), 'w1-a', 0, '10kg');
  expect(parseImport(JSON.stringify(good))).toEqual(good);
  const changes: ((s: any) => void)[] = [
    s => s.version = 9, s => s.week = 13, s => s.sessions['w1-a'].checked[0] = 'true', s => s.sessions['w1-a'].checked = [],
    s => s.sessions['w1-a'].completedAt = '<script>', s => s.title = 'injected', s => s.sessions.bad = s.sessions['w1-a'],
    s => s.sessions['w1-a'].loads[0] = 12, s => s.sessions['w1-a'].loads = [], s => s.sessions['w1-a'].loads[0] = 'x'.repeat(41),
    s => delete s.sessions['w1-a'].loads,
  ];
  for (const change of changes) {
    const value = structuredClone(good); change(value); expect(() => validateState(value)).toThrow();
  }
  expect(() => parseImport(JSON.stringify(good) + ' '.repeat(5_000_000))).toThrow(/5 Mo/);
  expect(() => parseImport('not json')).toThrow(/illisible/);
});

test('a stale tab cannot overwrite changes from another tab', () => {
  const disk = memory(), a = createStorage(() => disk), b = createStorage(() => disk); a.load(); b.load();
  a.save(complete(emptyState(), 'w1-a'));
  expect(() => b.save(emptyState())).toThrow(/autre onglet/);
  expect(completedKeys(a.load().state)).toHaveLength(1);
});

// ── New in Elo Fitness (formerly Eloise Sport) ──

const v1Record = (key: string, all: boolean) => ({
  checked: catalog[key].ex.map((_, i) => all || i === 0), completedAt: all ? stamp : null, endedAt: null,
});
const v1State = { version: 1, week: 3, sessions: { 'w1-a': v1Record('w1-a', true), 'w2-b': v1Record('w2-b', false) }, legacy: {} };

test('progress saved by the original GLUTELAB app is upgraded and the old key is left untouched', () => {
  const original = JSON.stringify(v1State);
  const disk = memory({ [V1_KEY]: original, 'gl-week': '9' });
  const { state, warnings } = createStorage(() => disk).load();
  expect(warnings).toEqual([]);
  expect(state.version).toBe(2); expect(state.week).toBe(3); // v1 wins over older gl-* keys
  expect(completedKeys(state)).toEqual(['w1-a']);
  expect(state.sessions['w2-b'].loads).toEqual(catalog['w2-b'].ex.map(() => ''));
  expect(disk.getItem(V1_KEY)).toBe(original);
  expect(JSON.parse(disk.getItem(STORAGE_KEY)!)).toEqual(state);
});

test('a corrupt original save blocks writes instead of starting over', () => {
  const disk = memory({ [V1_KEY]: '{broken' }), store = createStorage(() => disk);
  expect(store.load().warnings.length).toBeGreaterThan(0);
  expect(() => store.save(emptyState())).toThrow(/protégée/);
  expect(disk.getItem(STORAGE_KEY)).toBeNull();
});

test('old GLUTELAB backup files can be imported', () => {
  const state = parseImport(JSON.stringify(v1State));
  expect(state.version).toBe(2); expect(completedKeys(state)).toEqual(['w1-a']);
});

test('logging a weight is trimmed, capped and never changes completion', () => {
  let state = toggleExercise(emptyState(), 'w1-a', 0, stamp);
  state = setLoad(state, 'w1-a', 1, '  12kg  ');
  expect(state.sessions['w1-a'].loads[1]).toBe('12kg');
  expect(state.sessions['w1-a'].checked).toEqual([true, false, false, false, false, false]);
  expect(setLoad(state, 'w1-a', 1, 'x'.repeat(100)).sessions['w1-a'].loads[1]).toHaveLength(40);
  const fresh = setLoad(emptyState(), 'w1-b', 0, '8kg');
  expect(completedKeys(fresh)).toEqual([]); expect(historyEntries(fresh)).toEqual([]);
  expect(() => setLoad(state, 'w1-a', 9, '1')).toThrow();
});

test('previous weight comes from the latest earlier session with the same exercise', () => {
  const name = catalog['w1-a'].ex[0].n; // "Poussée de hanches au sol"
  let state = setLoad(emptyState(), 'w1-a', 0, '10kg');
  state = setLoad(state, 'w2-a', 0, '12kg');
  expect(previousLoad(state, 'w3-a', 0)).toBe('12kg');
  expect(previousLoad(state, 'w2-a', 0)).toBe('10kg');
  expect(previousLoad(state, 'w1-a', 0)).toBe('');
  expect(catalog['w3-a'].ex[0].n).toBe(name);
});

test('suggested session is the first unfinished one of the active week', () => {
  let state = { ...emptyState(), week: 2 };
  expect(suggestedSession(state).key).toBe('w2-a');
  state = complete(state, 'w2-a');
  expect(suggestedSession(state).key).toBe('w2-b');
});
