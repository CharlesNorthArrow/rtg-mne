// Muted footnote shown when the displayed numbers use a carried-forward
// ACS vintage (see docs/ASSUMPTIONS.md §H8). Used both in the year-slider
// area (when any visible row in the year is proxied) and inside the
// district header card (when the selected district-year is proxied).

const TITLE = 'ACS vintage for this year is not yet released. Denominator carried forward from the most recent vintage.'

export default function CensusProxyBadge({ sourceYear, className = '' }) {
  if (sourceYear == null) return null
  return (
    <span
      className={`shrink-0 text-[9px] ${className}`}
      style={{ color: 'var(--color-text-tertiary)' }}
      title={TITLE}
    >
      Census {sourceYear}
    </span>
  )
}
