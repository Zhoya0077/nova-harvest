// All sound is synthesized at runtime through WebAudio: no files, nothing fetched.
// The context is created lazily on the first user gesture, as browsers require.

import { STORAGE } from './config.js';

let ctx = null;
let master = null;
let muted = false;

/** Read the mute preference saved by an earlier session. */
export function loadMute() {
  try {
    muted = window.localStorage.getItem(STORAGE.mute) === '1';
  } catch {
    muted = false;
  }
  return muted;
}

/** Persist the mute preference; a private-mode browser may refuse, which is fine. */
function saveMute() {
  try {
    window.localStorage.setItem(STORAGE.mute, muted ? '1' : '0');
  } catch {
    /* storage is optional */
  }
}

/** Create the AudioContext on the first gesture. Safe to call repeatedly. */
export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  return ctx;
}

export function isMuted() {
  return muted;
}

/** Flip mute and apply it to the running graph. Returns the new state. */
export function toggleMute() {
  muted = !muted;
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
  }
  saveMute();
  return muted;
}

/** One shaped oscillator note. `at` is an offset in seconds from now. */
function tone({ freq, to, dur = 0.18, type = 'sine', gain = 0.32, at = 0, attack = 0.006, detune = 0 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** A short filtered noise burst, used for the hurt thud and shard pops. */
function noise({ dur = 0.22, gain = 0.3, at = 0, cutoff = 900, type = 'lowpass' }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.28), t0 + dur);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  src.start(t0);
}

// ---------------------------------------------------------------- the sound set

/** Catch blip: a bright rising ping, pitched up by the combo rung. */
export function sfxCatch(combo = 1) {
  const base = 520 + Math.min(7, combo - 1) * 46;
  tone({ freq: base, to: base * 1.6, dur: 0.11, type: 'triangle', gain: 0.22 });
  tone({ freq: base * 2, to: base * 2.1, dur: 0.07, type: 'sine', gain: 0.08, at: 0.01 });
}

/** Golden nova: a two-note chime with a shimmer tail. */
export function sfxNova() {
  const notes = [784, 988, 1319];
  notes.forEach((f, i) => tone({ freq: f, to: f * 1.01, dur: 0.34, type: 'sine', gain: 0.2, at: i * 0.06 }));
  tone({ freq: 2637, to: 2637, dur: 0.5, type: 'sine', gain: 0.05, at: 0.12, attack: 0.1 });
}

/** Hurt thud: a low sine drop plus muffled noise. */
export function sfxHurt() {
  tone({ freq: 190, to: 52, dur: 0.34, type: 'sawtooth', gain: 0.24 });
  tone({ freq: 96, to: 40, dur: 0.4, type: 'sine', gain: 0.3 });
  noise({ dur: 0.26, gain: 0.22, cutoff: 640 });
}

/** Pulse shot: a clipped zap. */
export function sfxPulse() {
  tone({ freq: 1400, to: 420, dur: 0.07, type: 'square', gain: 0.07 });
}

/** A shard breaking: a short noise crack. */
export function sfxShard() {
  noise({ dur: 0.14, gain: 0.16, cutoff: 2600, type: 'bandpass' });
  tone({ freq: 640, to: 260, dur: 0.1, type: 'triangle', gain: 0.08 });
}

/** Upgrade chosen: a rising four-note arpeggio. */
export function sfxUpgrade() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone({ freq: f, to: f, dur: 0.2, type: 'triangle', gain: 0.18, at: i * 0.075 }));
}

/** Wave cleared: a soft two-note call to the upgrade screen. */
export function sfxWave() {
  tone({ freq: 392, to: 392, dur: 0.22, type: 'sine', gain: 0.16 });
  tone({ freq: 587, to: 587, dur: 0.3, type: 'sine', gain: 0.14, at: 0.14 });
}

/** Shield absorbing a shard: a metallic clank. */
export function sfxShield() {
  tone({ freq: 240, to: 900, dur: 0.18, type: 'square', gain: 0.1 });
  noise({ dur: 0.12, gain: 0.12, cutoff: 3200, type: 'highpass' });
}

/** Game over: a long descending sweep. */
export function sfxGameOver() {
  tone({ freq: 440, to: 70, dur: 1.1, type: 'sawtooth', gain: 0.22, attack: 0.02 });
  tone({ freq: 220, to: 48, dur: 1.3, type: 'sine', gain: 0.2 });
  noise({ dur: 0.7, gain: 0.1, cutoff: 520 });
}
