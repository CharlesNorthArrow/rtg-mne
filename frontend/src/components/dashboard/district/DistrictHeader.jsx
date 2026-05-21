import { getTierConfig } from '../../../lib/tiers.js'
import { fmtBpc, fmtInt, countyShort, SD_TYPE_LABEL } from '../../../lib/format.js'
import CensusProxyBadge from '../CensusProxyBadge.jsx'

export default function DistrictHeader({ row, tier, ratio, lifetimeBooks, onClose }) {
  // `row` is the current-year row (may be null for picked districts with
  // no row in the selected year).
  const name   = row?.school_district_name ?? '—'
  const type   = SD_TYPE_LABEL[row?.sd_type] || row?.sd_type
  const county = countyShort(row?.county || '')
  const geoid  = row?.school_district_geoid
  const books  = row?.rolling_3yr_combined

  const cfg = getTierConfig(tier)
  const chipBg   = cfg.mapColor
  const chipText = cfg.textColor

  return (
    <div
      className="px-4 py-3"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {name}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {[type, county, geoid].filter(Boolean).join(' · ')}
          </div>
          {row?.census_is_proxy && (
            <div className="mt-0.5">
              <CensusProxyBadge sourceYear={row.census_source_year} />
            </div>
          )}
        </div>

        {/* Tier chip */}
        <div
          className="shrink-0 rounded px-2 py-1 text-[11px] font-medium"
          style={{
            background: chipBg,
            color: chipText,
            border: cfg.stripe ? '0.5px dashed var(--color-border-secondary)' : 'none',
          }}
          title={`Current tier (${cfg.label})`}
        >
          {tier == null ? 'No data' : `T${tier} · ${cfg.label}`}
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded px-1.5 py-1 text-sm leading-none hover:bg-gray-100"
          style={{ color: 'var(--color-text-tertiary)' }}
          title="Back to overview"
          aria-label="Back to overview"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Books per child (3-yr avg)" value={fmtBpc(ratio)} />
        <Stat label="Books distributed (3-yr)"   value={fmtInt(books)} />
        <Stat label="Lifetime books distributed" value={fmtInt(lifetimeBooks)} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}>
        {label}
      </div>
      <div className="font-medium tabular-nums leading-tight" style={{ fontSize: 18, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  )
}
