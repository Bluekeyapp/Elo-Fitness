import { P, type Session } from '../data/program';

export const VERSION = 2;
export const WEEKS = 12;
export const MAX_LOAD_LENGTH = 40;
export const LEGACY_KEYS = ['gl-done', 'gl-sessions', 'gl-history', 'gl-week'] as const;

export interface SessionRecord {
  checked: boolean[];
  /** Weight used per exercise, free text ("12kg", "élastique 20kg"); '' when not entered. */
  loads: string[];
  completedAt: string | null;
  endedAt: string | null;
}
export interface AppState {
  version: typeof VERSION;
  week: number;
  sessions: Record<string, SessionRecord>;
  legacy: Record<string, string>;
}
export interface CatalogSession extends Session { key: string; week: number; phase: number }

export const clampWeek = (w: unknown) => Math.min(WEEKS, Math.max(1, Math.trunc(Number(w)) || 1));
export const phaseForWeek = (w: number) => Math.floor((clampWeek(w) - 1) / 4);
export const sessionKey = (week: number, id: string) => `w${week}-${id}`;

/** Every session of the 12 weeks, keyed `w{week}-{sessionId}` (48 entries), in program order. */
export const catalog: Record<string, CatalogSession> = Object.fromEntries(
  Array.from({ length: WEEKS }, (_, i) => {
    const week = i + 1, phase = phaseForWeek(week);
    return P[phase].sessions.map(s => [sessionKey(week, s.id), { ...s, key: sessionKey(week, s.id), week, phase }]);
  }).flat(),
);
export const sessionsForWeek = (week: number) => Object.values(catalog).filter(s => s.week === week);

export const emptyState = (): AppState => ({ version: VERSION, week: 1, sessions: {}, legacy: {} });
export const emptyRecord = (key: string): SessionRecord => ({
  checked: catalog[key].ex.map(() => false), loads: catalog[key].ex.map(() => ''), completedAt: null, endedAt: null,
});
export const isComplete = (record: SessionRecord | undefined) => !!record && record.checked.every(Boolean);

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasExactKeys = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  isObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const isDate = (v: unknown) => v === null ||
  (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v);

/**
 * Strict import/storage boundary. Accepts the current format (v2) and the original
 * app's format (v1, no `loads`), always returns a fresh v2 object.
 */
export function validateState(value: unknown): AppState {
  const top = ['version', 'week', 'sessions', 'legacy'];
  if (!hasExactKeys(value, top) || (value.version !== 1 && value.version !== VERSION) ||
      !Number.isInteger(value.week) || (value.week as number) < 1 || (value.week as number) > WEEKS ||
      !isObject(value.sessions) || !isObject(value.legacy)) {
    throw new Error('Format ou version de sauvegarde non pris en charge.');
  }
  const v1 = value.version === 1;
  const sessions: Record<string, SessionRecord> = {};
  for (const [key, record] of Object.entries(value.sessions)) {
    const fields = v1 ? ['checked', 'completedAt', 'endedAt'] : ['checked', 'loads', 'completedAt', 'endedAt'];
    const size = Object.hasOwn(catalog, key) ? catalog[key].ex.length : -1;
    if (size < 0 || !hasExactKeys(record, fields) ||
        !Array.isArray(record.checked) || record.checked.length !== size || !record.checked.every(v => typeof v === 'boolean') ||
        (!v1 && (!Array.isArray(record.loads) || record.loads.length !== size ||
          !record.loads.every(v => typeof v === 'string' && v.length <= MAX_LOAD_LENGTH))) ||
        !isDate(record.completedAt) || !isDate(record.endedAt) ||
        (!(record.checked as boolean[]).every(Boolean) && record.completedAt !== null)) {
      throw new Error('Progression de séance invalide.');
    }
    sessions[key] = {
      checked: [...record.checked as boolean[]],
      loads: v1 ? Array(size).fill('') : [...record.loads as string[]],
      completedAt: record.completedAt as string | null,
      endedAt: record.endedAt as string | null,
    };
  }
  for (const [key, raw] of Object.entries(value.legacy)) {
    if (!(LEGACY_KEYS as readonly string[]).includes(key) || typeof raw !== 'string' || raw.length > 1_000_000) {
      throw new Error('Archive ancienne invalide.');
    }
  }
  return { version: VERSION, week: value.week as number, sessions, legacy: { ...value.legacy as Record<string, string> } };
}

function exerciseIndex(key: string, index: number) {
  if (!Object.hasOwn(catalog, key) || !Number.isInteger(index) || index < 0 || index >= catalog[key].ex.length) {
    throw new Error('Exercice inconnu.');
  }
}

/** A session is complete only when every exercise is checked; the last check records completion once. */
export function toggleExercise(state: AppState, key: string, index: number, now = new Date().toISOString()): AppState {
  exerciseIndex(key, index);
  const next = structuredClone(state);
  const record = next.sessions[key] ??= emptyRecord(key);
  record.checked[index] = !record.checked[index];
  record.completedAt = isComplete(record) ? now : null;
  record.endedAt = null; // Editing reopens a partial workout and retracts its previous finish.
  return next;
}

/** Logging a weight never changes completion. */
export function setLoad(state: AppState, key: string, index: number, value: string): AppState {
  exerciseIndex(key, index);
  const next = structuredClone(state);
  const record = next.sessions[key] ??= emptyRecord(key);
  record.loads[index] = value.trim().slice(0, MAX_LOAD_LENGTH);
  return next;
}

/** "Terminer" never checks anything: a partial session is recorded as partial, an empty one not at all. */
export function finishWorkout(state: AppState, key: string, now = new Date().toISOString()): AppState {
  if (!Object.hasOwn(catalog, key)) throw new Error('Séance inconnue.');
  const next = structuredClone(state);
  const record = next.sessions[key];
  if (!record || !record.checked.some(Boolean)) return next;
  if (isComplete(record)) record.completedAt ??= now;
  else record.endedAt ??= now;
  return next;
}

export const setWeek = (state: AppState, week: number): AppState => ({ ...structuredClone(state), week: clampWeek(week) });

/** Most recent weight logged for the same exercise name in an earlier session, to pre-fill the field. */
export function previousLoad(state: AppState, key: string, index: number): string {
  const name = catalog[key].ex[index].n;
  const keys = Object.keys(catalog);
  for (let i = keys.indexOf(key) - 1; i >= 0; i--) {
    const k = keys[i], j = catalog[k].ex.findIndex(e => e.n === name), load = state.sessions[k]?.loads[j];
    if (j >= 0 && load) return load;
  }
  return '';
}

export const completedKeys = (state: AppState) => Object.keys(state.sessions).filter(k => isComplete(state.sessions[k]));
export const weekIsDone = (state: AppState, week: number) => sessionsForWeek(week).every(s => isComplete(state.sessions[s.key]));
export const programIsDone = (state: AppState) => completedKeys(state).length === Object.keys(catalog).length;

export interface HistoryEntry {
  key: string; week: number; session: string; complete: boolean; count: number; total: number; date: string | null;
}
export const historyEntries = (state: AppState): HistoryEntry[] => Object.entries(state.sessions)
  .filter(([, r]) => isComplete(r) || r.endedAt)
  .map(([key, r]) => ({
    key, week: catalog[key].week, session: catalog[key].title, complete: isComplete(r),
    count: r.checked.filter(Boolean).length, total: r.checked.length, date: r.completedAt || r.endedAt,
  }))
  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.key.localeCompare(b.key));

/** The first not-yet-complete session of the active week, or its first session. */
export const suggestedSession = (state: AppState) =>
  sessionsForWeek(state.week).find(s => !isComplete(state.sessions[s.key])) ?? sessionsForWeek(state.week)[0];

export function sessionProgress(state: AppState, key: string) {
  const record = state.sessions[key], total = catalog[key].ex.length;
  const count = record ? record.checked.filter(Boolean).length : 0;
  return { count, total, complete: count === total, pct: Math.round((count / total) * 100), partial: !!record?.endedAt };
}
