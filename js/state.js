import { P } from './program.js?v=3';

export const VERSION = 1;
export const clampWeek = w => Math.min(12, Math.max(1, Math.trunc(Number(w)) || 1));
export const phaseForWeek = w => Math.floor((clampWeek(w) - 1) / 4);
export const catalog = Object.fromEntries(Array.from({ length: 12 }, (_, i) =>
  P[phaseForWeek(i + 1)].sessions.map(s => [`w${i + 1}-${s.id}`, { ...s, week: i + 1 }])).flat());
export const emptyState = () => ({ version: VERSION, week: 1, sessions: {}, legacy: {} });
export const isComplete = record => !!record && record.checked.every(Boolean);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const date = value => value === null || (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);

// Strict import/storage boundary. Return a fresh object, never a caller-owned object.
export function validateState(value) {
  if (!exact(value, ['version', 'week', 'sessions', 'legacy']) || value.version !== VERSION ||
      !Number.isInteger(value.week) || value.week < 1 || value.week > 12 || !object(value.sessions) || !object(value.legacy)) {
    throw new Error('Format ou version de sauvegarde non pris en charge.');
  }
  for (const [key, record] of Object.entries(value.sessions)) {
    if (!Object.hasOwn(catalog, key) || !exact(record, ['checked', 'completedAt', 'endedAt']) ||
        !Array.isArray(record.checked) || record.checked.length !== catalog[key].ex.length ||
        !record.checked.every(v => typeof v === 'boolean') || !date(record.completedAt) || !date(record.endedAt) ||
        (!isComplete(record) && record.completedAt !== null)) throw new Error('Progression de séance invalide.');
  }
  const legacyKeys = ['gl-done', 'gl-sessions', 'gl-history', 'gl-week'];
  for (const [key, raw] of Object.entries(value.legacy)) {
    if (!legacyKeys.includes(key) || typeof raw !== 'string' || raw.length > 1_000_000) throw new Error('Archive ancienne invalide.');
  }
  return JSON.parse(JSON.stringify(value));
}

export function toggleExercise(state, key, index, now = new Date().toISOString()) {
  if (!Object.hasOwn(catalog, key) || !Number.isInteger(index) || index < 0 || index >= catalog[key].ex.length) throw new Error('Exercice inconnu.');
  const next = structuredClone(state);
  const record = next.sessions[key] ??= { checked: catalog[key].ex.map(() => false), completedAt: null, endedAt: null };
  record.checked[index] = !record.checked[index];
  record.completedAt = isComplete(record) ? now : null;
  record.endedAt = null; // Editing reopens a partial workout and retracts its previous finish.
  return next;
}

export function finishWorkout(state, key, now = new Date().toISOString()) {
  if (!Object.hasOwn(catalog, key)) throw new Error('Séance inconnue.');
  const next = structuredClone(state);
  const record = next.sessions[key];
  if (!record || !record.checked.some(Boolean)) return next;
  if (isComplete(record)) record.completedAt ??= now;
  else record.endedAt ??= now;
  return next;
}

export const completedKeys = state => Object.keys(state.sessions).filter(key => isComplete(state.sessions[key]));
export const weekIsDone = (state, week) => Object.entries(catalog).filter(([, s]) => s.week === week).every(([key]) => isComplete(state.sessions[key]));
export const programIsDone = state => completedKeys(state).length === Object.keys(catalog).length;
export const historyEntries = state => Object.entries(state.sessions)
  .filter(([, record]) => isComplete(record) || record.endedAt)
  .map(([key, record]) => ({ key, week: catalog[key].week, session: catalog[key].title,
    complete: isComplete(record), count: record.checked.filter(Boolean).length, total: record.checked.length,
    date: record.completedAt || record.endedAt }))
  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.key.localeCompare(b.key));
