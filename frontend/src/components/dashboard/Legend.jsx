import { TIER_CONFIG, TIER_KEYS } from '../../lib/tiers.js'

export default function Legend({ tierMode = 'overall' }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
      <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {tierMode === 'hn' ? 'High-Needs tier' : 'Overall tier'}
      </span>
      {TIER_KEYS.map(t => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: TIER_CONFIG[t].mapColor }}
          />
          T{t} — {TIER_CONFIG[t].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded-sm"
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
  )
}
