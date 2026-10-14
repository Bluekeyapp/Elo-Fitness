import { catalog, clampWeek, emptyState, isComplete, validateState, LEGACY_KEYS, type AppState } from './state';

/** The test copy keeps its own progress so trying it never affects the real launch. */
export const STORAGE_KEY = __TEST_BUILD__ ? 'es-test-state-v2' : 'es-state-v2';
/** Key used by the original GLUTELAB app. Read once to upgrade, never modified or deleted. */
export const V1_KEY = 'gl-state-v1';
export const MAX_IMPORT_BYTES = 5_000_000;

type KV = Pick<Storage, 'getItem' | 'setItem'>;
export interface LoadResult { state: AppState; warnings: string[] }
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Rebuild progress from the very first app's separate gl-* keys without inventing checks. */
export function migrateLegacy(raw: Record<string, string>): LoadResult {
  const state = emptyState(), warnings: string[] = [];
  state.legacy = { ...raw }; // Preserve original evidence, including contradictory history.
  function read<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
    if (!(key in raw)) return fallback;
    try { const v = JSON.parse(raw[key]); if (!valid(v)) throw Error(); return v as T; }
    catch { warnings.push(`${key} illisible : original conservé dans l’archive.`); return fallback; }
  }
  const done = read<Record<string, unknown>>('gl-done', {}, isObject);
  const sessions = read<Record<string, { date?: unknown }>>('gl-sessions', {}, isObject);
  const history = read<unknown[]>('gl-history', [], Array.isArray);
  state.week = clampWeek(read('gl-week', 1, v => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12));
  let conflicts = 0;
  for (const [key, session] of Object.entries(catalog)) {
    const checked = session.ex.map((_, i) => done[`${key}-${i}`] === true);
    if (checked.some(Boolean)) {
      const record = { checked, loads: session.ex.map(() => ''), completedAt: null as string | null, endedAt: null };
      const stamp = sessions[key]?.date;
      if (isComplete(record) && typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))) record.completedAt = new Date(stamp).toISOString();
      state.sessions[key] = record;
    }
    if (sessions[key] && !checked.every(Boolean)) conflicts++;
  }
  const known = new Set(Object.entries(catalog).flatMap(([key, s]) => s.ex.map((_, i) => `${key}-${i}`)));
  if (Object.entries(done).some(([k, v]) => !known.has(k) || typeof v !== 'boolean') ||
      Object.keys(sessions).some(k => !Object.hasOwn(catalog, k))) {
    warnings.push('Certaines anciennes entrées ne correspondent pas au programme : elles restent dans l’archive.');
  }
  if (conflicts) warnings.push(`${conflicts} ancienne(s) séance(s) déclarée(s) terminée(s) sans tous les exercices cochés : cochez les exercices réellement faits pour les valider. Les déclarations originales sont conservées.`);
  if (history.some(e => !isObject(e) || typeof e.key !== 'string' || !Object.hasOwn(catalog, e.key) || !isComplete(state.sessions[e.key]))) {
    warnings.push('Des lignes de l’ancien historique sont sans exercices complets correspondants. Elles restent dans l’archive exportable, sans gonfler les totaux.');
  }
  return { state: validateState(state), warnings };
}

/** The provider is lazy: even accessing localStorage can throw in restricted browsers. */
export function createStorage(provider: () => KV = () => localStorage) {
  let blocked = false, lastSaved: string | null = null;

  function upgrade(storage: KV): LoadResult {
    const v1 = storage.getItem(V1_KEY);
    let result: LoadResult;
    if (v1 !== null) {
      try { result = { state: validateState(JSON.parse(v1)), warnings: [] }; }
      catch {
        blocked = true;
        return { state: emptyState(), warnings: ['Ancienne sauvegarde illisible. Original conservé ; écriture bloquée. Exportez les données brutes puis importez une sauvegarde valide.'] };
      }
    } else {
      const raw: Record<string, string> = {};
      for (const key of LEGACY_KEYS) { const v = storage.getItem(key); if (v !== null) raw[key] = v; }
      result = migrateLegacy(raw);
      if (Object.keys(raw).length) result.warnings.unshift('Ancienne progression récupérée. Les clés gl-* originales restent conservées.');
    }
    try { const s = JSON.stringify(result.state); storage.setItem(STORAGE_KEY, s); lastSaved = s; }
    catch { result.warnings.push('Stockage indisponible : progression en mémoire seulement. Exportez avant de fermer.'); }
    return result;
  }

  return {
    load(): LoadResult {
      try {
        const storage = provider(), saved = storage.getItem(STORAGE_KEY);
        lastSaved = saved;
        if (saved === null) return upgrade(storage);
        try { return { state: validateState(JSON.parse(saved)), warnings: [] }; }
        catch {
          blocked = true;
          return { state: emptyState(), warnings: ['Sauvegarde illisible ou version inconnue. Original conservé ; écriture bloquée. Exportez les données brutes puis importez une sauvegarde valide.'] };
        }
      } catch {
        blocked = true;
        return { state: emptyState(), warnings: ['Lecture du stockage impossible. Progression en mémoire seulement ; exportez avant de fermer.'] };
      }
    },
    save(state: AppState, { replace = false } = {}) {
      const checked = validateState(state);
      if (blocked && !replace) throw new Error('Sauvegarde protégée : exportez puis importez un fichier valide avant de remplacer les données.');
      const storage = provider();
      if (!replace && storage.getItem(STORAGE_KEY) !== lastSaved) throw new Error('Progression modifiée dans un autre onglet. Exportez puis rechargez.');
      const serialized = JSON.stringify(checked);
      storage.setItem(STORAGE_KEY, serialized);
      lastSaved = serialized;
      blocked = false;
    },
    /** Diagnostic dump of every key this app (or its predecessors) ever wrote. */
    raw(): Record<string, string | null> {
      const storage = provider();
      return Object.fromEntries([STORAGE_KEY, V1_KEY, ...LEGACY_KEYS].map(k => [k, storage.getItem(k)]));
    },
  };
}

/** Accepts backups from this app (v2) and from the original GLUTELAB app (v1). */
export function parseImport(text: string): AppState {
  if (text.length > MAX_IMPORT_BYTES) throw new Error('Fichier trop volumineux (5 Mo maximum).');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Fichier illisible : ce n’est pas une sauvegarde JSON.'); }
  return validateState(value);
}
