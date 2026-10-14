const PREFS_KEY = 'es-prefs';

interface Prefs { sound: boolean; vibrate: boolean }

function readPrefs(): Prefs {
  const defaults = { sound: true, vibrate: true };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return { sound: saved.sound !== false, vibrate: saved.vibrate !== false };
  } catch { return defaults; }
}

/** Per-device preferences for the end-of-rest alert. */
export const prefs = $state<Prefs>(readPrefs());

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Preference only: keep it in memory. */ }
}

let audio: AudioContext | null = null;

/** Must run during a tap: iOS only lets audio play from a context created or resumed by the user. */
export function unlockAudio() {
  if (!prefs.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch { audio = null; }
}

function beep(at: number, frequency: number, duration = 0.16) {
  if (!audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = 'sine'; osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(at); osc.stop(at + duration + 0.02);
}

/** End-of-rest signal: three rising beeps and a double vibration, each optional. */
export function restAlert() {
  if (prefs.sound && audio) {
    try {
      const t = audio.currentTime + 0.05;
      beep(t, 660); beep(t + 0.22, 660); beep(t + 0.44, 990, 0.32);
    } catch { /* Sound is a convenience; the visual alert remains. */ }
  }
  if (prefs.vibrate) {
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* Not supported (e.g. iPhone). */ }
  }
}

/** Preview the alert from settings. */
export function testAlert() { unlockAudio(); restAlert(); }
