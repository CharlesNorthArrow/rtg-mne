import { TIER_CONFIG, TIER_KEYS } from '../../lib/tiers.js'

const STRIPE_FILL =
  'repeating-linear-gradient(45deg, var(--color-border-tertiary) 0 3px, var(--color-background-secondary) 3px 6px)'

export default function TierDistribution({ year, dist }) {
  const { counts, total } = dist
  // Show segments in tier order, no-data on the right
  const segments = [
    ...TIER_KEYS.map(t => ({ key: t, count: counts[t] || 0, ...TIER_CONFIG[t] })),
    { key: 'null', count: counts.null || 0, label: 'No data', isNull: true },
  ].filter(s => s.count > 0)

  return (
    <div
      className="p-4"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Tier distribution · {year ?? '—'}
      </div>
      {total === 0 ? (
        <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No districts in view.</div>
      ) : (
        <>
          <div className="flex h-8 overflow-hidden" style={{ borderRadius: 4 }}>
            {segments.map(seg => {
              const pct = (seg.count / total) * 100
              const showLabel = seg.count >= 4
              return (
                <div
                  key={seg.key}
                  className="flex items-center justify-center text-[11px] font-medium"
                  title={`${seg.label}: ${seg.count} districts (${pct.toFixed(0)}%)`}
                  style={{
                    width: `${pct}%`,
                    background: seg.isNull ? undefined : seg.mapColor,
                    backgroundImage: seg.isNull ? STRIPE_FILL : undefined,
                    color: seg.isNull ? 'var(--color-text-secondary)' : (seg.textColor || 'var(--color-text-primary)'),
                  }}
                >
                  {showLabel ? seg.count : ''}
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 flex text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
            {segments.map(seg => (
              <span
                key={seg.key}
                style={{ width: `${(seg.count / total) * 100}%`, textAlign: 'center' }}
              >
                {seg.isNull ? 'ND' : `T${seg.key}`} ({seg.count})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
