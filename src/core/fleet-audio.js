// ── Jurvus Fleet SFX (Phase 3) ──
// Lightweight WebAudio synth in the spirit of ThreeJS-Ball's warm tones:
// pentatonic pings for activity, a low buzz for errors, soft click on select.
// Master volume + mute, persisted in localStorage.

let ctx = null;
let master = null;
let volume = parseFloat(localStorage.getItem('jurvus-sfx-volume') ?? '0.5');
let muted = localStorage.getItem('jurvus-sfx-muted') === '1';

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

// Unlock audio on first user gesture (browser autoplay policy)
['click', 'keydown', 'touchstart'].forEach(evt =>
  window.addEventListener(evt, () => ensureCtx(), { once: true, passive: true })
);

function tone({ freq, dur = 0.35, type = 'triangle', gain = 0.5, delay = 0, glideTo = null }) {
  if (!ensureCtx() || (muted && master.gain.value === 0)) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(env); env.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

// Pentatonic base (A minor penta — matches the ball's musical-scale approach)
const PENTA = [220, 261.63, 293.66, 329.63, 392];

export function sfxRunning(seed = 0) {
  const f = PENTA[Math.abs(seed) % PENTA.length] * 2;
  tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.35 });
  tone({ freq: f * 1.5, dur: 0.22, type: 'sine', gain: 0.18, delay: 0.06 });
}

export function sfxDone(seed = 0) {
  const f = PENTA[Math.abs(seed) % PENTA.length];
  tone({ freq: f * 2, dur: 0.18, type: 'sine', gain: 0.2 });
  tone({ freq: f * 3, dur: 0.3, type: 'sine', gain: 0.12, delay: 0.09 });
}

export function sfxError() {
  for (let i = 0; i < 3; i++) {
    tone({ freq: 138, dur: 0.16, type: 'sawtooth', gain: 0.22, delay: i * 0.22 });
    tone({ freq: 146.8, dur: 0.16, type: 'sawtooth', gain: 0.22, delay: i * 0.22 });
  }
}

export function sfxSelect() {
  tone({ freq: 660, dur: 0.09, type: 'square', gain: 0.12, glideTo: 880 });
}

// ── ThreeJS-Ball facet audio port (Phase 3b) ──
// Faithful to the ball's core.js recipe: baseFreq 220 + (facet%12)*50,
// waveform cycles by facet, ±50¢ detune, 5ms attack / 100ms release.

const FACET_WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

export function sfxFacet(facetIndex, u = 0.5) {
  if (!ensureCtx() || muted) return;
  const baseFreq = 220 + (facetIndex % 12) * 50;
  const freq = baseFreq + 30 * (u - 0.5);
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = FACET_WAVES[facetIndex % FACET_WAVES.length];
  osc.detune.value = (facetIndex * 7) % 100 - 50;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(0.18, t0 + 0.005);
  env.gain.linearRampToValueAtTime(0.12, t0 + 0.05);
  env.gain.linearRampToValueAtTime(0, t0 + 0.1);
  osc.connect(env); env.connect(master);
  osc.start(t0); osc.stop(t0 + 0.15);
}

// Ball chords: click = E major, release = C major
const CHORDS = {
  click: [164.81, 207.65, 246.94, 329.63],   // E3 G#3 B3 E4
  release: [130.81, 164.81, 196.0, 261.63],  // C3 E3 G3 C4
};

export function sfxChord(name = 'click') {
  const notes = CHORDS[name] || CHORDS.click;
  notes.forEach((f, i) => tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.14, delay: i * 0.015 }));
}

// ── Controls API ──

export function setSfxVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem('jurvus-sfx-volume', String(volume));
  if (master && !muted) master.gain.value = volume;
}

export function getSfxVolume() { return volume; }

export function setSfxMuted(m) {
  muted = !!m;
  localStorage.setItem('jurvus-sfx-muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : volume;
}

export function isSfxMuted() { return muted; }
