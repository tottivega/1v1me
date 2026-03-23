# DESIGN.md — 1v1 ME

> Visual and UX philosophy for the project. Keep this updated as decisions are made.

---

## Visual Style

**Vibe:** Newgrounds-era browser game. Loud, cartoony, playful. Not a polished SaaS product — a scrappy game site.

**Typography**
- Headings / scores / game names: `Fredoka One` (Google Fonts)
- Body / labels / subtitles: system sans-serif stack

**Color palette** (CSS variables in `client/src/index.css`)
| Variable | Hex | Use |
|---|---|---|
| `--black` | `#1a1a1a` | Borders, text |
| `--white` | `#ffffff` | Card backgrounds |
| `--bg` | `#f5f0e8` | Page background (cream) |
| `--orange` | `#ff6b35` | Primary CTA, accents |
| `--yellow` | `#ffd700` | Highlights, coins |
| `--green` | `#44cc44` | Wins, success |
| `--red` | `#ff3333` | Losses, danger |
| `--blue` | `#4488ff` | Player 1 color |
| `--purple` | `#9966ff` | Trivia category |
| `--pink` | `#ff66aa` | Accent |

**Borders & shadows**
- All interactive elements: `3px solid var(--black)` border
- Cards/buttons: `4–6px solid black` box-shadow offset (no blur) — gives a sticker/stamp feel
- Border radius: 12–16px on cards, full round on buttons/coins

---

## Animation Philosophy

Animations should feel **punchy and immediate**, never smooth or corporate.

- Use `@keyframes` in `index.css`, not inline or JS-driven tweens
- Key animations: `bounce-in`, `anim-pop`, `anim-pulse`, `score-pop`, `count-in`, `ripple`, `coin-flip-3d`, `confetti-fall`
- Score changes: `key` trick to restart animations (remount forces replay)
- Round transitions: 1.9s overlay with 3→2→1 count-in blocks interaction
- Timer bar: shifts green → yellow → red at 33% / 15% thresholds

---

## UX Principles

1. **No login, no friction.** Nickname only. Share a link, start playing.
2. **Server is truth.** The client never decides outcomes — it animates them.
3. **Dual mode.** Every minigame works in mock/dev mode (no server needed) with a simulated opponent.
4. **Mobile-first layouts**, desktop gets extra polish. 600px breakpoint.
5. **Sound is opt-in.** Web Audio API synth (zero audio files). Mute toggle persisted in `localStorage`.
6. **Zero libraries for effects.** Confetti, ripples, sounds — all hand-coded. No canvas libs, no animation libs.

---

## Minigame Design Rules

- Each game must be completable in ≤ 30 seconds
- Must have a clear, single winner (draws are resolved server-side randomly)
- Visual feedback must be instantaneous (optimistic UI where safe)
- Mock mode must be convincing enough to demo solo
- Keep description ≤ 2 sentences for the tooltip
