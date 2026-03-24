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

// ── Ambient Loop System ────────────────────────────────────────────────────────
// Each minigame gets a distinct looping ambient background while it's active.
// All notes are routed through a shared master GainNode so stopAmbient() can
// fade everything out in one shot. Volume is ~25% of the user's master level —
// present but never competing with gameplay SFX.

let _ambientInterval: ReturnType<typeof setInterval> | null = null
let _ambientMaster: GainNode | null = null

/** Play a note routed through the ambient master gain. */
function aTone(
  mg: GainNode,
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.1,
  delay = 0
) {
  const c = ctx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.connect(g)
  g.connect(mg)
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + delay)
  g.gain.setValueAtTime(vol, c.currentTime + delay)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur)
  osc.start(c.currentTime + delay)
  osc.stop(c.currentTime + delay + dur + 0.02)
}

/** Play a pitch sweep routed through the ambient master gain. */
function aSweep(
  mg: GainNode,
  f0: number,
  f1: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.1,
  delay = 0
) {
  const c = ctx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.connect(g)
  g.connect(mg)
  osc.type = type
  osc.frequency.setValueAtTime(f0, c.currentTime + delay)
  osc.frequency.exponentialRampToValueAtTime(f1, c.currentTime + delay + dur)
  g.gain.setValueAtTime(vol, c.currentTime + delay)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur)
  osc.start(c.currentTime + delay)
  osc.stop(c.currentTime + delay + dur + 0.02)
}

// Each entry: [intervalMs, ticker(mg, phase, vol)]
type Ticker = (mg: GainNode, phase: number, vol: number) => void
const AMBIENT: Record<string, [number, Ticker]> = {
  // ── CLICK SPEED ──────────────────────────────────────────────────────────────
  // Frantic arcade urgency: fast alternating square-wave ticks, like a
  // countdown machine. Two staggered pitches give a punchy rat-tat feel.
  clickspeed: [
    170,
    (mg, phase, vol) => {
      const freqs = [1100, 880, 1320, 880]
      const f = freqs[phase % 4]!
      aTone(mg, f, 0.05, 'square', vol * 0.5, 0)
      if (phase % 4 === 0) aTone(mg, f * 1.5, 0.03, 'square', vol * 0.25, 0.085)
    },
  ],

  // ── COIN FLIP ────────────────────────────────────────────────────────────────
  // Shimmering anticipation: slow arpeggiated chime in C major. Each note has
  // a warm sub-octave for body. Spaced far apart — feels like floating.
  coinflip: [
    780,
    (mg, phase, vol) => {
      const notes = [523, 659, 784, 659] // C5 E5 G5 E5
      const f = notes[phase % 4]!
      aTone(mg, f, 0.55, 'sine', vol * 0.75, 0)
      aTone(mg, f * 0.5, 0.7, 'sine', vol * 0.25, 0) // warm sub
    },
  ],

  // ── REACTION TEST ─────────────────────────────────────────────────────────────
  // Slow heartbeat — lub-DUB then silence. Ultra-low frequencies create a
  // visceral physical tension. The gap between beats is the whole point.
  reactiontest: [
    620,
    (mg, phase, vol) => {
      if (phase % 2 === 0) {
        aTone(mg, 62, 0.2, 'sine', vol * 0.95, 0) // deep "lub"
        aTone(mg, 80, 0.15, 'sine', vol * 0.7, 0.22) // higher "DUB"
        aTone(mg, 124, 0.1, 'sine', vol * 0.2, 0.22) // subtle overtone
      }
      // Odd phases = silence — the tension IS the silence
    },
  ],

  // ── NUMBER GUESS ─────────────────────────────────────────────────────────────
  // Quirky, mischievous plinking: pentatonic scale in an irregular rhythm.
  // Triangle wave keeps it gentle. The off-beat pauses add personality.
  numberguess: [
    370,
    (mg, phase, vol) => {
      const penta = [523, 587, 659, 784, 880, 784, 659, 587]
      const rests = [3, 7] // skip these phases
      if (!rests.includes(phase % 8)) {
        const f = penta[phase % 8]!
        aTone(mg, f, 0.13, 'triangle', vol * 0.55, 0)
      }
    },
  ],

  // ── QUICK MATHS ──────────────────────────────────────────────────────────────
  // Calculator urgency: crisp square-wave grid, four beats with syncopation.
  // High-low alternation makes it feel like rapid mental computation.
  quickmaths: [
    190,
    (mg, phase, vol) => {
      const pattern: [number, number][] = [
        [880, 0.7],
        [0, 0],
        [1100, 0.5],
        [0, 0],
        [880, 0.6],
        [1320, 0.45],
        [0, 0],
        [1100, 0.55],
      ]
      const [f, v] = pattern[phase % 8]!
      if (f > 0) aTone(mg, f, 0.04, 'square', vol * v, 0)
    },
  ],

  // ── MEMORY MATCH ─────────────────────────────────────────────────────────────
  // Mysterious, contemplative pad: slow G-minor drone with layered harmonics.
  // Long, overlapping sine notes create an atmospheric shimmer. Very gentle.
  memorymatch: [
    1700,
    (mg, _phase, vol) => {
      aTone(mg, 196, 1.6, 'sine', vol * 0.6, 0) // G2 — root
      aTone(mg, 294, 1.45, 'sine', vol * 0.4, 0.12) // D3 — fifth
      aTone(mg, 370, 1.3, 'sine', vol * 0.25, 0.28) // F#3 — colour note
      aTone(mg, 392, 1.2, 'sine', vol * 0.18, 0.45) // G3 — octave
    },
  ],

  // ── FASTEST TYPER ────────────────────────────────────────────────────────────
  // Typewriter bursts: clusters of short mechanical square pulses simulating
  // rapid keystrokes, with pauses between words. Pitch varies slightly per hit.
  fastesttyper: [
    280,
    (mg, phase, vol) => {
      const wordLen = [5, 4, 6, 3, 5, 4][phase % 6]! // varying burst length
      const isPause = phase % 7 === 6
      if (!isPause) {
        for (let i = 0; i < wordLen; i++) {
          const pitch = 680 + (i % 3) * 35
          aTone(mg, pitch, 0.022, 'square', vol * 0.45, i * 0.052)
        }
      }
    },
  ],

  // ── ROCK PAPER SCISSORS ───────────────────────────────────────────────────────
  // Dramatic standoff: three ascending sawtooth notes cycle upward, building
  // tension like a duel. Each hit has a bright harmonic overtone.
  rockpaperscissors: [
    580,
    (mg, phase, vol) => {
      const steps = [110, 147, 196] // A2 D3 G3
      const f = steps[phase % 3]!
      aTone(mg, f, 0.3, 'sawtooth', vol * 0.5, 0)
      aTone(mg, f * 2, 0.18, 'sine', vol * 0.2, 0.06) // bright overtone
    },
  ],

  // ── WORD SCRAMBLE ────────────────────────────────────────────────────────────
  // Bouncy letter-tumbling energy: a cheerful 8-note pentatonic melody on a
  // triangle wave. Upbeat and light — matches the playful word-puzzle feel.
  wordscramble: [
    175,
    (mg, phase, vol) => {
      const melody = [392, 523, 659, 784, 880, 784, 659, 523]
      const f = melody[phase % 8]!
      aTone(mg, f, 0.1, 'triangle', vol * 0.55, 0)
    },
  ],

  // ── COLOR WORD ───────────────────────────────────────────────────────────────
  // Kaleidoscopic shimmer: three slightly detuned sines create an acoustic
  // beating/chorus effect. Occasional bright accent notes add sparkle.
  colorword: [
    420,
    (mg, phase, vol) => {
      // Shimmer triad — beat frequency ≈ 3.5 Hz creates a gentle wobble
      aTone(mg, 440, 0.38, 'sine', vol * 0.42, 0)
      aTone(mg, 443.5, 0.38, 'sine', vol * 0.38, 0)
      aTone(mg, 436.5, 0.38, 'sine', vol * 0.32, 0)
      // Bright accent every 3rd cycle
      if (phase % 3 === 0) {
        const accents = [880, 1047, 784, 1175]
        aTone(mg, accents[phase % 4]!, 0.1, 'sine', vol * 0.3, 0.2)
      }
    },
  ],

  // ── HIGHER OR LOWER ───────────────────────────────────────────────────────────
  // Sweeping direction: the sound itself goes up then down, aurally representing
  // the Higher/Lower concept. Smooth sine sweeps, contemplative pace.
  higherorlower: [
    880,
    (mg, phase, vol) => {
      if (phase % 2 === 0) {
        aSweep(mg, 300, 560, 0.75, 'sine', vol * 0.6, 0) // rising — "Higher?"
        aTone(mg, 560, 0.12, 'sine', vol * 0.35, 0.75) // arrival note
      } else {
        aSweep(mg, 560, 300, 0.75, 'sine', vol * 0.6, 0) // falling — "Lower?"
        aTone(mg, 300, 0.12, 'sine', vol * 0.35, 0.75) // arrival note
      }
    },
  ],
}

/** Stop any active ambient loop with a quick 250ms fade-out. */
export function stopAmbient(): void {
  if (_ambientInterval) {
    clearInterval(_ambientInterval)
    _ambientInterval = null
  }
  if (_ambientMaster) {
    const mg = _ambientMaster
    const c = ctx()
    mg.gain.cancelScheduledValues(c.currentTime)
    mg.gain.setValueAtTime(mg.gain.value, c.currentTime)
    mg.gain.linearRampToValueAtTime(0, c.currentTime + 0.25)
    setTimeout(() => {
      try {
        mg.disconnect()
      } catch {}
    }, 500)
    _ambientMaster = null
  }
}

/**
 * Start the ambient loop for the given minigame.
 * Safe to call multiple times — stops any previous ambient first.
 */
export function startAmbient(minigameId: string): void {
  stopAmbient()
  if (guard()) return

  const entry = AMBIENT[minigameId]
  if (!entry) return

  const [intervalMs, ticker] = entry
  const c = ctx()
  const mg = c.createGain()
  const baseVol = getVolume() * 0.25

  // Fade in over 400ms to avoid a click/pop at round start
  mg.gain.setValueAtTime(0, c.currentTime)
  mg.gain.linearRampToValueAtTime(baseVol, c.currentTime + 0.4)
  mg.connect(c.destination)
  _ambientMaster = mg

  let phase = 0
  ticker(mg, phase, baseVol)
  phase++

  _ambientInterval = setInterval(() => {
    if (!_ambientMaster) return
    ticker(mg, phase, baseVol)
    phase++
  }, intervalMs)
}
