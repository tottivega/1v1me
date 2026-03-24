// Synthesised sound effects via Web Audio API — no audio files needed.
// All sounds are generated programmatically and respect browser autoplay policy
// (AudioContext is only created after the first user interaction).

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  // Resume if browser suspended it (common on mobile)
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// ── Volume control ─────────────────────────────────────────────────────────────

const VOLUME_KEY = 'soundVolume'
const DEFAULT_VOLUME = 0.7

export function getVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '')
    if (!isNaN(v) && v >= 0 && v <= 1) return v
  } catch {}
  return DEFAULT_VOLUME
}

export function setVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, v))))
  } catch {}
}

// Legacy compat — kept so existing callers outside this file still compile
export function isMuted(): boolean {
  return getVolume() === 0
}
export function setMuted(val: boolean) {
  setVolume(val ? 0 : DEFAULT_VOLUME)
}

function guard(): boolean {
  return getVolume() === 0
}

// ── Primitive builders ────────────────────────────────────────────────────────

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.25,
  delay = 0
) {
  const c = ctx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + delay)
  gain.gain.setValueAtTime(volume * getVolume(), c.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration)
  osc.start(c.currentTime + delay)
  osc.stop(c.currentTime + delay + duration)
}

function sweep(
  freqStart: number,
  freqEnd: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
  delay = 0
) {
  const c = ctx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freqStart, c.currentTime + delay)
  osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + delay + duration)
  gain.gain.setValueAtTime(volume * getVolume(), c.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration)
  osc.start(c.currentTime + delay)
  osc.stop(c.currentTime + delay + duration)
}

// ── Public sound API ──────────────────────────────────────────────────────────

/** Generic UI button click */
export function playClick() {
  if (guard()) return
  tone(900, 0.04, 'square', 0.15)
}

/** Ready-up / confirmation click */
export function playReady() {
  if (guard()) return
  tone(600, 0.06, 'sine', 0.2)
  tone(900, 0.1, 'sine', 0.2, 0.06)
}

/** Quick Maths / Number Guess — correct answer */
export function playCorrect() {
  if (guard()) return
  tone(880, 0.08, 'sine', 0.25)
  tone(1100, 0.12, 'sine', 0.2, 0.08)
}

/** Quick Maths / Number Guess — wrong answer */
export function playWrong() {
  if (guard()) return
  sweep(350, 180, 0.18, 'sawtooth', 0.2)
}

/** Reaction Test — "GO!" signal */
export function playReactionGo() {
  if (guard()) return
  tone(1200, 0.06, 'square', 0.3)
  tone(1500, 0.1, 'square', 0.25, 0.06)
}

/** Reaction Test — too early */
export function playEarly() {
  if (guard()) return
  sweep(400, 150, 0.25, 'sawtooth', 0.25)
}

/** Coin flip — spinning effect */
export function playCoinFlip() {
  if (guard()) return
  // Rapid oscillating pitch simulates a spinning coin
  for (let i = 0; i < 8; i++) {
    const freq = i % 2 === 0 ? 700 : 500
    tone(freq, 0.08, 'sine', 0.12, i * 0.09)
  }
}

/** Coin flip — result reveal */
export function playCoinResult(win: boolean) {
  if (guard()) return
  if (win) {
    tone(523, 0.1, 'sine', 0.3)
    tone(659, 0.1, 'sine', 0.25, 0.1)
    tone(784, 0.2, 'sine', 0.2, 0.2)
  } else {
    tone(400, 0.1, 'sine', 0.25)
    tone(320, 0.1, 'sine', 0.2, 0.1)
    tone(250, 0.2, 'sine', 0.2, 0.2)
  }
}

/** Round end — you won */
export function playRoundWin() {
  if (guard()) return
  tone(523, 0.08, 'sine', 0.3)
  tone(659, 0.08, 'sine', 0.25, 0.09)
  tone(784, 0.15, 'sine', 0.2, 0.18)
}

/** Round end — you lost */
export function playRoundLose() {
  if (guard()) return
  tone(400, 0.1, 'sine', 0.25)
  tone(300, 0.15, 'sine', 0.2, 0.12)
}

/** Match end — you won (fanfare) */
export function playMatchWin() {
  if (guard()) return
  const notes = [523, 659, 784, 1047, 784, 1047]
  const times = [0, 0.1, 0.2, 0.3, 0.42, 0.5]
  notes.forEach((f, i) => tone(f, 0.15, 'sine', 0.3, times[i]))
}

/** Match end — you lost (sad trombone) */
export function playMatchLose() {
  if (guard()) return
  sweep(400, 350, 0.15, 'sawtooth', 0.25, 0)
  sweep(350, 280, 0.15, 'sawtooth', 0.2, 0.18)
  sweep(280, 200, 0.25, 'sawtooth', 0.2, 0.36)
}

/** Click Speed — each click */
export function playClickHit() {
  if (guard()) return
  tone(1000, 0.025, 'square', 0.12)
}

/** Round transition count-in tick (3…2…1) */
export function playTick(final = false) {
  if (guard()) return
  if (final) {
    // "1" — sharper, higher
    tone(1100, 0.05, 'square', 0.22)
    tone(1600, 0.08, 'sine', 0.18, 0.05)
  } else {
    tone(660, 0.07, 'sine', 0.18)
  }
}
