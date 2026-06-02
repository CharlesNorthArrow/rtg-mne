import { TIER_CONFIG, TIER_KEYS } from '../../lib/tiers.js'

export default function Legend({ showNoOutcomeNote = false }) {
  return (
    <div className="mt-2 px-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
      <div className="flex flex-nowrap items-center justify-between gap-x-2 whitespace-nowrap overflow-hidden">
        {TIER_KEYS.map(t => (
          <span key={t} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ background: TIER_CONFIG[t].mapColor }}
            />
            T{t} | {TIER_CONFIG[t].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
            style={{
              background: 'transparent',
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--color-border-tertiary) 0 2px, transparent 2px 4px)',
              border: '1px solid var(--color-border-secondary)',
            }}
          />
          No data
        </span>
      </div>
      {showNoOutcomeNote && (
        <div className="mt-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Hatched districts have no outcome data for this year.
        </div>
      )}
    </div>
  )
}
