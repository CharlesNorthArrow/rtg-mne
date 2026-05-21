// Pure derivers for the district-detail right column (Phase 3).
// Take the full panel + a geoid and compute the per-district views.

// ── One district's rows, sorted by year ─────────────────────────────────
export function districtSeries(panel, geoid) {
  if (!panel || !geoid) return []
  return panel
    .filter(r => r.school_district_geoid === geoid)
    .sort((a, b) => a.year - b.year)
}

function hasAnyData(row) {
  return row.tier_overall != null
      || (row.books_combined != null && row.books_combined > 0)
      || (row.rolling_3yr_combined != null && row.rolling_3yr_combined > 0)
}

// ── Lifetime rows for the SVG bar chart ─────────────────────────────────
// Returns one entry per year between the first and last year with any data,
// inclusive. Internal gap years are filled with { year, isNoData: true }.
export function lifetimeRows(series) {
  if (!series || series.length === 0) return []
  const withData = series.filter(hasAnyData)
  if (withData.length === 0) return []
  const yMin = withData[0].year
  const yMax = withData[withData.length - 1].year
  const byYear = new Map(series.map(r => [r.year, r]))
  const out = []
  for (let y = yMin; y <= yMax; y++) {
    const row = byYear.get(y)
    if (row && hasAnyData(row)) out.push({ year: y, row, isNoData: false })
    else out.push({ year: y, row: row ?? null, isNoData: true })
  }
  return out
}

// ── Demographics series (HN% + Overall vs HN ratios for selected age) ───
export function demographicsSeries(series, ratioField, ratioHnField) {
  if (!series || series.length === 0) {
    return { years: [], hnPct: [], ratioOverall: [], ratioHn: [] }
  }
  const sorted = [...series].sort((a, b) => a.year - b.year)
  return {
    years:        sorted.map(r => r.year),
    hnPct:        sorted.map(r => r.doe_high_needs_pct ?? null),
    ratioOverall: sorted.map(r => r[ratioField] ?? null),
    ratioHn:      sorted.map(r => r[ratioHnField] ?? null),
  }
}
