import { catalog, emptyState, validateState, clampWeek, isComplete } from './state.js?v=3';

export const STORAGE_KEY = 'gl-state-v1';
export const LEGACY_KEYS = ['gl-done', 'gl-sessions', 'gl-history', 'gl-week'];
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function migrateLegacy(raw) {
  const state = emptyState(), warnings = [];
  state.legacy = { ...raw }; // Preserve original evidence, including contradictory history.
  function read(key, fallback, valid) {
    if (!(key in raw)) return fallback;
    try { const value = JSON.parse(raw[key]); if (!valid(value)) throw Error(); return value; }
    catch { warnings.push(`${key} illisible : original conservé dans l’archive.`); return fallback; }
  }
  const done = read('gl-done', {}, plain);
  const sessions = read('gl-sessions', {}, plain);
  const history = read('gl-history', [], Array.isArray);
  state.week = clampWeek(read('gl-week', 1, v => Number.isInteger(v) && v >= 1 && v <= 12));
  let conflicts = 0;
  for (const [key, session] of Object.entries(catalog)) {
    const checked = session.ex.map((_, i) => done[`${key}-${i}`] === true);
    if (checked.some(Boolean)) {
      const record = { checked, completedAt: null, endedAt: null };
      const stamp = sessions[key]?.date;
      if (isComplete(record) && typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))) record.completedAt = new Date(stamp).toISOString();
      state.sessions[key] = record;
    }
    if (sessions[key] && !checked.every(Boolean)) conflicts++;
  }
  const knownExercises = new Set(Object.entries(catalog).flatMap(([key, s]) => s.ex.map((_, i) => `${key}-${i}`)));
  if (Object.entries(done).some(([k, v]) => !knownExercises.has(k) || typeof v !== 'boolean') ||
      Object.keys(sessions).some(k => !Object.hasOwn(catalog, k))) warnings.push('Certaines anciennes entrées ne correspondent pas au programme : elles restent dans l’archive.');
  if (conflicts) warnings.push(`${conflicts} ancienne(s) séance(s) déclarée(s) terminée(s) sans tous les exercices cochés : cochez les exercices réellement faits pour les valider. Les déclarations originales sont conservées.`);
  if (history.some(entry => !plain(entry) || !Object.hasOwn(catalog, entry.key) || !isComplete(state.sessions[entry.key]))) warnings.push('Des lignes de l’ancien historique sont sans exercices complets correspondants. Elles restent dans l’archive exportable, sans gonfler les totaux.');
  return { state: validateState(state), warnings };
}

// The provider is lazy: even accessing localStorage can throw in restricted browsers.
export function createStorage(provider = () => localStorage) {
  let blocked = false, lastSaved = null;
  return {
    load() {
      try {
        const storage = provider(), saved = storage.getItem(STORAGE_KEY);
        lastSaved = saved;
        if (saved !== null) {
          try { return { state: validateState(JSON.parse(saved)), warnings: [] }; }
          catch { blocked = true; return { state: emptyState(), warnings: ['Sauvegarde illisible ou version inconnue. Original conservé ; écriture bloquée. Exportez les données brutes puis importez une sauvegarde valide.'] }; }
        }
        const raw = {};
        for (const key of LEGACY_KEYS) { const value = storage.getItem(key); if (value !== null) raw[key] = value; }
        const result = migrateLegacy(raw);
        if (Object.keys(raw).length) result.warnings.unshift('Ancienne progression récupérée. Les clés gl-* originales restent conservées.');
        try { const serialized = JSON.stringify(result.state); storage.setItem(STORAGE_KEY, serialized); lastSaved = serialized; }
        catch { result.warnings.push('Stockage indisponible : progression en mémoire seulement. Exportez avant de fermer.'); }
        return result;
      } catch {
        blocked = true;
        return { state: emptyState(), warnings: ['Lecture du stockage impossible. Progression en mémoire seulement ; exportez avant de fermer.'] };
      }
    },
    save(state, { replace = false } = {}) {
      const checked = validateState(state);
      if (blocked && !replace) throw new Error('Sauvegarde protégée : exportez puis importez un fichier valide avant de remplacer les données.');
      const storage = provider();
      if (!replace && storage.getItem(STORAGE_KEY) !== lastSaved) throw new Error('Progression modifiée dans un autre onglet. Exportez puis rechargez.');
      const serialized = JSON.stringify(checked);
      storage.setItem(STORAGE_KEY, serialized);
      lastSaved = serialized;
      blocked = false;
    },
    raw() {
      const storage = provider();
      return Object.fromEntries([STORAGE_KEY, ...LEGACY_KEYS].map(key => [key, storage.getItem(key)]));
    }
  };
}

export function parseImport(text) {
  if (text.length > 5_000_000) throw new Error('Fichier trop volumineux (5 Mo maximum).');
  return validateState(JSON.parse(text));
}
