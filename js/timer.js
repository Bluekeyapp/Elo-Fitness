// Clock and scheduler injection make suspension/resume deterministic in tests.
export function createTimer({ now = Date.now, schedule = setInterval, cancel = clearInterval, onChange = () => {}, onComplete = () => {} } = {}) {
  let deadline = null, handle = null, status = 'idle';
  const snapshot = () => ({ status, deadline, remaining: deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now()) / 1000)) });
  function reconcile() {
    if (status === 'running' && now() >= deadline) {
      status = 'complete'; cancel(handle); handle = null;
      onChange(snapshot()); onComplete();
    } else onChange(snapshot());
    return snapshot();
  }
  function stop() { cancel(handle); handle = null; deadline = null; status = 'idle'; onChange(snapshot()); }
  return {
    start(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      stop(); deadline = now() + seconds * 1000; status = 'running';
      handle = schedule(reconcile, 250); reconcile();
    },
    stop, reconcile, snapshot
  };
}
