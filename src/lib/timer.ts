export type TimerStatus = 'idle' | 'running' | 'paused' | 'complete';
export interface TimerSnapshot { status: TimerStatus; deadline: number | null; remaining: number; total: number }

interface TimerOptions {
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  onChange?: (s: TimerSnapshot) => void;
  onComplete?: () => void;
}

/**
 * Countdown based on an absolute deadline, never a decremented counter, so it stays
 * correct after the phone sleeps. Clock and scheduler injection make tests deterministic.
 */
export function createTimer({
  now = Date.now,
  schedule = (fn, ms) => setInterval(fn, ms),
  cancel = h => clearInterval(h as ReturnType<typeof setInterval>),
  onChange = () => {},
  onComplete = () => {},
}: TimerOptions = {}) {
  let deadline: number | null = null, handle: unknown = null, status: TimerStatus = 'idle', total = 0;
  let pausedMs = 0; // time left while paused
  const remainingMs = () => status === 'paused' ? pausedMs : deadline === null ? 0 : Math.max(0, deadline - now());
  const snapshot = (): TimerSnapshot => ({ status, deadline, total, remaining: Math.ceil(remainingMs() / 1000) });
  function reconcile() {
    if (status === 'running' && deadline !== null && now() >= deadline) {
      status = 'complete'; cancel(handle); handle = null;
      onChange(snapshot()); onComplete();
    } else onChange(snapshot());
    return snapshot();
  }
  function stop() { cancel(handle); handle = null; deadline = null; status = 'idle'; total = 0; pausedMs = 0; onChange(snapshot()); }
  function run(ms: number) {
    deadline = now() + ms; status = 'running';
    handle = schedule(reconcile, 250); reconcile();
  }
  return {
    start(seconds: number) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      stop(); total = seconds; run(seconds * 1000);
    },
    pause() {
      if (status !== 'running') return;
      pausedMs = remainingMs(); cancel(handle); handle = null; deadline = null; status = 'paused'; onChange(snapshot());
    },
    resume() {
      if (status !== 'paused') return;
      run(pausedMs);
    },
    /** Add (or remove, with a negative value) time; never ends the countdown by itself. */
    adjust(seconds: number) {
      if (status === 'paused') pausedMs = Math.max(1000, pausedMs + seconds * 1000);
      else if (status === 'running' && deadline !== null) deadline = Math.max(now() + 1000, deadline + seconds * 1000);
      else return;
      total = Math.max(1, total + seconds); reconcile();
    },
    stop, reconcile, snapshot,
  };
}
