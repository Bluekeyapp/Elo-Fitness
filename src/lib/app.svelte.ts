import { createStorage, parseImport, STORAGE_KEY, MAX_IMPORT_BYTES } from './storage';
import {
  catalog, clampWeek, completedKeys, finishWorkout, setLoad, setWeek, toggleExercise, type AppState,
} from './state';
import { createTimer, type TimerSnapshot } from './timer';
import { prefs, restAlert, unlockAudio } from './alerts.svelte';
import { buildSteps, firstStepOf, isLastSet, resumeStep, workStepFrom, type Step } from './flow';
import { keepAwake, releaseAwake } from './wakelock';

export type Route =
  | { name: 'home' }
  | { name: 'workout'; key: string }
  | { name: 'play'; key: string }
  | { name: 'done'; key: string }
  | { name: 'progress' }
  | { name: 'tips' };

/** Hash routes give the phone's back button/gesture natural behavior. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if ((parts[0] === 'seance' || parts[0] === 'fin') && Object.hasOwn(catalog, parts[1] ?? '')) {
    if (parts[0] === 'fin') return { name: 'done', key: parts[1] };
    return parts[2] === 'go' ? { name: 'play', key: parts[1] } : { name: 'workout', key: parts[1] };
  }
  if (parts[0] === 'progres') return { name: 'progress' };
  if (parts[0] === 'conseils') return { name: 'tips' };
  return { name: 'home' };
}
export function routeHash(route: Route): string {
  switch (route.name) {
    case 'workout': return `#/seance/${route.key}`;
    case 'play': return `#/seance/${route.key}/go`;
    case 'done': return `#/fin/${route.key}`;
    case 'progress': return '#/progres';
    case 'tips': return '#/conseils';
    default: return '#/';
  }
}

/**
 * Guided workout position. `ready`: a set is shown, waiting for the user;
 * `effort`: a timed exercise's countdown is running; `rest`: the rest countdown is running.
 */
export interface Player {
  key: string;
  steps: Step[];
  index: number;
  phase: 'ready' | 'effort' | 'rest';
  side: 1 | 2;
}

interface Confirmation { message: string; confirmLabel: string; resolve: (ok: boolean) => void }

const storage = createStorage();
const loaded = storage.load();

class App {
  /** Replaced as a whole on every change (never mutated), so no deep proxy is needed. */
  state = $state.raw<AppState>(loaded.state);
  notice = $state(loaded.warnings.join(' '));
  unsaved = $state(false);
  route = $state<Route>({ name: 'home' });
  timer = $state<TimerSnapshot>({ status: 'idle', deadline: null, remaining: 0, total: 0 });
  confirmation = $state<Confirmation | null>(null);
  updateReady = $state<null | (() => void)>(null);
  player = $state<Player | null>(null);

  #timer = createTimer({
    onChange: s => { this.timer = s; },
    onComplete: () => { restAlert(); this.#timerDone(); },
  });

  commit(next: AppState) {
    this.state = next;
    try { storage.save(next); this.unsaved = false; }
    catch (e) {
      this.unsaved = true;
      this.notice = `Progression non sauvegardée sur cet appareil. Elle reste en mémoire : exportez-la avant de fermer. ${(e as Error).message}`;
    }
  }

  // ── Navigation ──
  go(route: Route) {
    const hash = routeHash(route);
    if (location.hash !== hash) location.hash = hash; // hashchange calls syncRoute
    else this.#enter(route);
  }
  syncRoute() { this.#enter(parseRoute(location.hash)); }
  #enter(route: Route) {
    if (route.name === 'play') {
      // Opened directly (reload, back/forward): resume where the session left off.
      if (this.player?.key !== route.key) this.#initPlayer(route.key);
      void keepAwake();
    } else {
      this.#timer.stop();
      this.player = null;
      releaseAwake();
    }
    this.route = route;
  }

  // ── Progress ──
  toggle(key: string, index: number) { this.commit(toggleExercise(this.state, key, index)); }
  setLoad(key: string, index: number, value: string) { this.commit(setLoad(this.state, key, index, value)); }
  setWeek(week: number) { this.commit(setWeek(this.state, clampWeek(week))); }

  async finish(key: string) {
    const record = this.state.sessions[key], total = catalog[key].ex.length;
    const count = record?.checked.filter(Boolean).length ?? 0;
    if (count < total && !await this.ask(
      `${count} / ${total} exercices cochés. Terminer cette séance partielle ? Elle ne comptera pas comme une séance complète.`,
      'Terminer quand même')) return;
    this.commit(finishWorkout(this.state, key));
    this.go({ name: 'done', key });
  }

  // ── Guided workout ──
  /** Open the full-screen player at the given exercise, or where the session left off. */
  play(key: string, exercise?: number) {
    unlockAudio(); // during the tap, so the end-of-timer sound is allowed later (iOS)
    this.#initPlayer(key, exercise);
    this.go({ name: 'play', key });
  }
  #initPlayer(key: string, exercise?: number) {
    this.#timer.stop();
    const steps = buildSteps(catalog[key].ex);
    const checked = this.state.sessions[key]?.checked ?? [];
    const index = exercise === undefined ? resumeStep(steps, checked) : firstStepOf(steps, exercise);
    this.player = { key, steps, index, phase: 'ready', side: 1 };
  }
  get step(): Step | null { return this.player ? this.player.steps[this.player.index] : null; }

  /** Main button on a timed exercise: start the effort countdown (or the second side). */
  startEffort() {
    const p = this.player, step = this.step;
    if (!p || step?.kind !== 'work' || !step.duration) return;
    unlockAudio();
    p.phase = 'effort';
    this.#timer.start(step.duration);
  }
  /** Main button on a regular exercise, or "finished early" on a timed one. */
  completeSet() {
    const p = this.player, step = this.step;
    if (!p || step?.kind !== 'work') return;
    unlockAudio();
    this.#timer.stop();
    if (isLastSet(step) && !this.state.sessions[p.key]?.checked[step.ex]) this.toggle(p.key, step.ex);
    this.#advance(p.index + 1);
  }
  /** Skip the current set without counting it. */
  skip() {
    const p = this.player; if (!p) return;
    const next = workStepFrom(p.steps, p.index, 1);
    if (next === null) void this.#end(); else this.#show(next);
  }
  previous() {
    const p = this.player; if (!p) return;
    const prev = workStepFrom(p.steps, p.index, -1);
    if (prev !== null) this.#show(prev);
  }
  /** "Exercice suivant" / "Série suivante" once the rest countdown is over. */
  skipRest() {
    const p = this.player;
    if (p?.phase === 'rest') { this.#timer.stop(); this.#advance(p.index + 1); }
  }
  pauseTimer() { this.#timer.pause(); }
  resumeTimer() { this.#timer.resume(); }
  adjustTimer(seconds: number) { this.#timer.adjust(seconds); }
  reconcileTimer() { this.#timer.reconcile(); }

  #timerDone() {
    const p = this.player, step = this.step;
    if (!p || !step) return;
    // End of rest: the alert sounds and the rest screen offers the next exercise (see skipRest).
    if (p.phase === 'rest') return;
    if (p.phase === 'effort' && step.kind === 'work') {
      if (step.sides === 2 && p.side === 1) { p.side = 2; p.phase = 'ready'; }
      else this.completeSet();
    }
  }
  #show(index: number) {
    const p = this.player!;
    this.#timer.stop();
    p.index = index; p.side = 1; p.phase = 'ready';
  }
  #advance(index: number) {
    const p = this.player!;
    if (index >= p.steps.length) { void this.#end(); return; }
    const next = p.steps[index];
    if (next.kind === 'rest') {
      p.index = index; p.side = 1; p.phase = 'rest';
      this.#timer.start(next.seconds);
    } else this.#show(index);
  }
  /** End of the flow: record the session (asking first if some exercises were skipped). */
  async #end() {
    const key = this.player!.key;
    this.#timer.stop();
    if (this.state.sessions[key]?.checked.every(Boolean)) {
      this.commit(finishWorkout(this.state, key));
      this.go({ name: 'done', key });
    } else await this.finish(key);
  }

  // ── Dialog ──
  ask(message: string, confirmLabel = 'Confirmer'): Promise<boolean> {
    this.confirmation?.resolve(false);
    return new Promise(resolve => {
      this.confirmation = { message, confirmLabel, resolve: ok => { this.confirmation = null; resolve(ok); } };
    });
  }

  // ── Backup ──
  exportProgress() { download(this.state, 'elo-fitness-progression.json'); }
  exportRaw() {
    try { download(storage.raw(), 'elo-fitness-donnees-brutes.json'); }
    catch { this.notice = 'Lecture des données brutes impossible. Exportez la progression en mémoire.'; }
  }
  async importFile(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Fichier trop volumineux (5 Mo maximum).');
      const next = parseImport(await file.text());
      if (!await this.ask(
        `Remplacer toute la progression actuelle par ce fichier (semaine ${next.week}, ${completedKeys(next).length} séances terminées) ? Les progrès actuels seront écrasés : exportez-les d’abord si nécessaire.`,
        'Remplacer')) return;
      storage.save(next, { replace: true });
      this.state = next; this.unsaved = false;
      this.notice = 'Sauvegarde importée et enregistrée.';
      this.go({ name: 'home' });
    } catch (e) {
      this.notice = `Import refusé, progression actuelle conservée. ${(e as Error).message}`;
    }
  }

  // ── Updates ──
  applyUpdate() {
    if (this.unsaved) { this.notice = 'Exportez la progression non sauvegardée avant de mettre à jour.'; return; }
    this.updateReady?.();
  }

  prefs = prefs;
}

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const app = new App();
app.syncRoute(); // also sets up the player when the app is opened on a workout

addEventListener('hashchange', () => app.syncRoute());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  app.reconcileTimer();
  if (app.route.name === 'play') void keepAwake(); // the browser drops the lock when the page is hidden
});
addEventListener('pageshow', () => app.reconcileTimer());
addEventListener('focus', () => app.reconcileTimer());
addEventListener('storage', e => {
  if (e.key === STORAGE_KEY) app.notice = 'La progression a changé dans un autre onglet. Rechargez avant de continuer pour ne pas écraser ces changements.';
});
addEventListener('beforeunload', e => { if (app.unsaved) e.preventDefault(); });
