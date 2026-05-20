// Pure functions that derive dashboard views from the panel.
// Panel = full district_tiers rows array (one row per district per year).
// All selectors take the panel + filter state; return plain JS values.
//
// tierOf(row) and ratioOf(row) are caller-supplied accessors so the selectors
// don't care whether the active age bracket has pre-computed tiers in the DB
// or whether they need to be computed on the fly.

import { TIER_KEYS } from './tiers.js'

// ── Indexing ────────────────────────────────────────────────────────────
export function indexByYear(panel) {
  const m = new Map()
  for (const row of panel) {
    if (!m.has(row.year)) m.set(row.year, [])
    m.get(row.year).push(row)
  }
  return m
}

export function indexByGeoid(panel) {
  const m = new Map()
  for (const row of panel) {
    if (!m.has(row.school_district_geoid)) m.set(row.school_district_geoid, [])
    m.get(row.school_district_geoid).push(row)
  }
  for (const arr of m.values()) arr.sort((a, b) => a.year - b.year)
  return m
}

// ── Year-range derivation ───────────────────────────────────────────────
export function deriveYearRange(panel) {
  const minEnv = import.meta.env.VITE_YEAR_MIN
  const maxEnv = import.meta.env.VITE_YEAR_MAX
  const ys = [...new Set(panel.filter(r => r.tier_overall != null).map(r => r.year))]
    .sort((a, b) => a - b)
  return {
    min: minEnv ? parseInt(minEnv) : (ys[0] ?? null),
    max: maxEnv ? parseInt(maxEnv) : (ys[ys.length - 1] ?? null),
  }
}

// ── KPI strip ───────────────────────────────────────────────────────────
export function kpisFor({ rowsByYear, year, visibleSet, tierOf, ratioOf, topN = 5 }) {
  const current = restrict(rowsByYear.get(year),     visibleSet)
  const prior   = restrict(rowsByYear.get(year - 1), visibleSet)

  const calc = (rows) => {
    if (!rows) return null
    const total   = rows.length
    const books   = rows.reduce((s, r) => s + (r.rolling_3yr_combined || 0), 0)
    const reached = rows.filter(r => (r.rolling_3yr_combined || 0) > 0).length
    const high    = rows.filter(r => { const t = tierOf(r); return t === 4 || t === 5 }).length
    const low     = rows.filter(r => { const t = tierOf(r); return t === 0 || t === 1 }).length
    const ratios  = rows.map(r => ratioOf(r)).filter(v => v != null && !isNaN(v))
    const avgBpc  = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null
    return { total, books, reached, high, low, avgBpc }
  }

  const ranked = (current || [])
    .map(r => ({
      geoid: r.school_district_geoid,
      name:  r.school_district_name,
      ratio: ratioOf(r),
      tier:  tierOf(r),
    }))
    .filter(r => r.ratio != null && !isNaN(r.ratio))
    .sort((a, b) => b.ratio - a.ratio)

  const top    = ranked.slice(0, topN)
  const bottom = ranked.slice(-topN).reverse()

  return { current: calc(current), prior: calc(prior), top, bottom }
}

// ── Tier distribution ───────────────────────────────────────────────────
export function tierDistributionFor({ rowsByYear, year, visibleSet, tierOf }) {
  const rows = restrict(rowsByYear.get(year), visibleSet) || []
  const counts = Object.fromEntries(TIER_KEYS.map(t => [t, 0]))
  counts.null = 0
  for (const r of rows) {
    const t = tierOf(r)
    if (t == null) counts.null += 1
    else counts[t] = (counts[t] || 0) + 1
  }
  return { counts, total: rows.length }
}

// ── Progression ─────────────────────────────────────────────────────────
export function progressionFor({ rowsByYear, yMin, yMax, visibleSet, tierOf }) {
  const years = []
  const series = Object.fromEntries(TIER_KEYS.map(t => [t, []]))
  series.null = []

  for (let y = yMin; y <= yMax; y++) {
    years.push(y)
    const rows = restrict(rowsByYear.get(y), visibleSet) || []
    const c = Object.fromEntries(TIER_KEYS.map(t => [t, 0]))
    c.null = 0
    for (const r of rows) {
      const t = tierOf(r)
      if (t == null) c.null += 1
      else c[t] = (c[t] || 0) + 1
    }
    for (const t of TIER_KEYS) series[t].push(c[t])
    series.null.push(c.null)
  }
  return { years, series }
}

function restrict(rows, visibleSet) {
  if (!rows) return null
  if (visibleSet === 'all') return rows
  return rows.filter(r => visibleSet.has(r.school_district_geoid))
}
