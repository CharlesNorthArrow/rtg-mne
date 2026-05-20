export const fmtInt = (n) =>
  n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US')

export const fmtBpc = (n) =>
  n == null || isNaN(n) ? '—' : n.toFixed(3)

export const fmtPct = (n) =>
  n == null || isNaN(n) ? '—' : `${Math.round(n * 100)}%`

// "+12" / "−3" / "no change". Null means "no prior data" — caller decides whether
// to render or hide the line.
export function fmtDelta(now, prev) {
  if (now == null || prev == null || isNaN(now) || isNaN(prev)) return null
  const d = Math.round(now) - Math.round(prev)
  if (d === 0) return 'no change'
  const sign = d > 0 ? '+' : '−'
  return `${sign}${Math.abs(d).toLocaleString('en-US')} vs prev year`
}

// Like fmtDelta but pairs the absolute change with a % change.
// kind: 'int' (rounds to nearest int) or 'float' (3 decimals)
export function fmtDeltaPair(now, prev, kind = 'int') {
  if (now == null || prev == null || isNaN(now) || isNaN(prev)) return null
  const roundIf = (v) => kind === 'int' ? Math.round(v) : v
  const d = roundIf(now) - roundIf(prev)
  if (d === 0) return 'no change'
  const sign = d > 0 ? '+' : '−'
  const absStr = kind === 'int'
    ? Math.abs(d).toLocaleString('en-US')
    : Math.abs(d).toFixed(3)
  if (prev === 0) return `${sign}${absStr} (new)`
  const pct = Math.round((d / Math.abs(prev)) * 100)
  return `${sign}${absStr} (${sign}${Math.abs(pct)}%)`
}

// Returns the structured delta so callers can color each part independently.
// Shape: { abs: '+12', pct: '+8%', sign: 'positive' | 'negative' | 'neutral' }
// Returns null when prior data isn't available.
export function fmtDeltaParts(now, prev, kind = 'int') {
  if (now == null || prev == null || isNaN(now) || isNaN(prev)) return null
  const roundIf = (v) => kind === 'int' ? Math.round(v) : v
  const d = roundIf(now) - roundIf(prev)
  if (d === 0) return { abs: 'no change', pct: '', sign: 'neutral' }
  const s = d > 0 ? '+' : '−'
  const sign = d > 0 ? 'positive' : 'negative'
  const absStr = kind === 'int'
    ? Math.abs(d).toLocaleString('en-US')
    : Math.abs(d).toFixed(3)
  if (prev === 0) return { abs: `${s}${absStr}`, pct: 'new', sign }
  const pct = Math.round((d / Math.abs(prev)) * 100)
  return { abs: `${s}${absStr}`, pct: `${s}${Math.abs(pct)}%`, sign }
}

// Strip the trailing " County" suffix from CT county names for compact display
export const countyShort = (c) => (c || '').replace(/\s+County$/i, '')

export const SD_TYPE_LABEL = {
  unsd: 'Unified School District',
  elsd: 'Elementary School District',
}
