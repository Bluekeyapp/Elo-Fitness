// Keeps the screen on during a guided workout (where supported) so the phone doesn't lock mid-rest.
let lock: WakeLockSentinel | null = null;

export async function keepAwake() {
  if (lock && !lock.released) return;
  try { lock = (await navigator.wakeLock?.request('screen')) ?? null; } catch { lock = null; }
}

export function releaseAwake() {
  void lock?.release().catch(() => {});
  lock = null;
}
