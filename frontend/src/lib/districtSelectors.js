// Pure derivers for the district-detail right column (Phase 3).
// Take the full panel + a geoid and compute the per-district views.

import { ratioFieldName } from './tiers.js'

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

// ── Demographics series ────────────────────────────────────────────────
// Returns data for the two right-column mini charts.
//
// LEFT chart — share of enrolled students by subgroup:
//   econDisShare / elShare / swdShare = count / doe_total_enrollment.
//   Plus optional split arrays for Econ Dis (Free / Reduced Price) and
//   SwD (7 disability sub-types).
//
// RIGHT chart — Overall vs HN books-per-child ratio (precomputed in DB,
// so it picks up H8 proxy + G1+D2 zero-reach behaviour for free).
export function demographicsSeries(series, age) {
  const empty = {
    years: [], ratioOverall: [], ratioHn: [],
    econDisShare: [], elShare: [], swdShare: [],
    econDisSplitShare: { freeMeals: [], reducedPrice: [] },
    swdSplitShare: {
      autism: [], emotional: [], intellectual: [], learning: [],
      other: [], otherHealth: [], speech: [],
    },
  }
  if (!series || series.length === 0) return empty
  const sorted = [...series].sort((a, b) => a.year - b.year)
  const ratioField   = ratioFieldName('overall', age)
  const ratioHnField = ratioFieldName('hn',      age)

  const shareOf = (countField) => sorted.map(r => {
    const c = r[countField]
    const t = r.doe_total_enrollment
    if (c == null || t == null || t === 0) return null
    return c / t
  })

  return {
    years:        sorted.map(r => r.year),
    ratioOverall: sorted.map(r => r[ratioField] ?? null),
    ratioHn:      sorted.map(r => r[ratioHnField] ?? null),
    econDisShare: shareOf('doe_econ_dis_count'),
    elShare:      shareOf('doe_english_learner_count'),
    swdShare:     shareOf('doe_swd_count'),
    econDisSplitShare: {
      freeMeals:    shareOf('doe_free_meals_count'),
      reducedPrice: shareOf('doe_reduced_price_count'),
    },
    swdSplitShare: {
      autism:       shareOf('doe_swd_autism_count'),
      emotional:    shareOf('doe_swd_emotional_count'),
      intellectual: shareOf('doe_swd_intellectual_count'),
      learning:     shareOf('doe_swd_learning_count'),
      other:        shareOf('doe_swd_other_count'),
      otherHealth:  shareOf('doe_swd_other_health_count'),
      speech:       shareOf('doe_swd_speech_count'),
    },
  }
}
