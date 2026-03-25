import { MINIGAME_CONFIGS, type MinigameCategory, type RoomConfig } from '@shared/types'
import {
  CATEGORY_COLORS,
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  BEST_OF_OPTIONS,
  BAN_COUNT_OPTIONS,
} from './constants'

export default function RoomSettings({
  config,
  isCreator,
  locked,
  onChange,
}: {
  config: RoomConfig
  isCreator: boolean
  locked: boolean
  onChange: (cfg: RoomConfig) => void
}) {
  const interactive = isCreator && !locked

  function setBestOf(n: 3 | 5 | 7 | 9) {
    if (!interactive) return
    onChange({ ...config, bestOf: n })
  }

  function setBanCount(n: 0 | 1 | 2 | 3) {
    if (!interactive) return
    onChange({ ...config, banCount: n })
  }

  function toggleCategory(cat: MinigameCategory) {
    if (!interactive) return
    const enabled = config.enabledCategories.includes(cat)
    // Must keep at least one category
    if (enabled && config.enabledCategories.length === 1) return
    const next = enabled
      ? config.enabledCategories.filter((c) => c !== cat)
      : [...config.enabledCategories, cat]
    onChange({ ...config, enabledCategories: next })
  }

  return (
    <div
      className="card"
      style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="label" style={{ fontSize: 11, opacity: 0.6 }}>
        MATCH SETTINGS {!isCreator && <span style={{ fontWeight: 400 }}>(set by host)</span>}
        {locked && <span style={{ fontWeight: 400 }}> — locked</span>}
      </div>

      {/* Best-of selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>Best of</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {BEST_OF_OPTIONS.map((n) => (
            <button
              key={n}
              aria-label={`best-of-${n}`}
              className={`btn btn-sm ${config.bestOf === n ? 'btn-orange' : 'btn-white'}`}
              style={{ flex: 1, opacity: interactive || config.bestOf === n ? 1 : 0.5 }}
              onClick={() => setBestOf(n)}
              disabled={!interactive}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Ban count */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>
          Bans per player
          <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.5, marginLeft: 6 }}>
            each player bans N games before the match
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {BAN_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              aria-label={`bans-${n === 0 ? 'off' : n}`}
              className={`btn btn-sm ${config.banCount === n ? 'btn-orange' : 'btn-white'}`}
              style={{ flex: 1, opacity: interactive || config.banCount === n ? 1 : 0.5 }}
              onClick={() => setBanCount(n)}
              disabled={!interactive}
            >
              {n === 0 ? 'Off' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>Game types</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_CATEGORIES.map((cat) => {
            const on = config.enabledCategories.includes(cat)
            return (
              <button
                key={cat}
                className={`btn btn-sm ${on ? 'btn-white' : 'btn-white'}`}
                style={{
                  opacity: interactive ? 1 : on ? 1 : 0.35,
                  background: on ? CATEGORY_COLORS[cat] : 'var(--cream)',
                  color: on && cat !== 'luck' ? 'var(--white)' : 'var(--black)',
                  border: '2px solid var(--black)',
                  fontWeight: 800,
                  fontSize: 11,
                }}
                onClick={() => toggleCategory(cat)}
                disabled={!interactive}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Game pool summary */}
      {(() => {
        const count = Object.values(MINIGAME_CONFIGS).filter(
          (cfg) =>
            config.enabledCategories.length === 0 || config.enabledCategories.includes(cfg.category)
        ).length
        return (
          <div
            style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 700, textAlign: 'right' }}
          >
            {count} game{count !== 1 ? 's' : ''} in pool · best of {config.bestOf}
          </div>
        )
      })()}
    </div>
  )
}
