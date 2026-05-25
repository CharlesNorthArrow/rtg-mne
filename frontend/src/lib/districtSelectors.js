// Pure derivers for the district-detail right column (Phase 3).
// Take the full panel + a geoid and compute the per-district views.

import { TIER_COEFFICIENTS, ratioFieldName } from './tiers.js'

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

// ── Per-age helpers ─────────────────────────────────────────────────────
const POP_FIELD_BY_AGE  = { '0_4': 'census_pop_0_4', '0_9': 'census_pop_0_9', '5_9': 'census_pop_5_9' }
const COEFF_BY_AGE      = { '0_4': 'coeff_0_4',      '0_9': 'coeff_0_9',     '5_9': 'coeff_5_9' }

// Subgroup-ratio formula: (books * coeff_age) / (census_pop_age * subgroup_pct)
// where subgroup_pct = doe_<subgroup>_count / doe_total_enrollment. NULL when
// any input is missing.
function subgroupRatio(row, age, subgroupCountField) {
  const books = row.rolling_3yr_combined
  const pop   = row[POP_FIELD_BY_AGE[age]]
  const total = row.doe_total_enrollment
  const sub   = row[subgroupCountField]
  if (books == null || pop == null || pop === 0 || total == null || total === 0 || sub == null) return null
  const coeff = TIER_COEFFICIENTS[COEFF_BY_AGE[age]]
  return (books * coeff) / (pop * (sub / total))
}

// ── Demographics series ────────────────────────────────────────────────
// Returns the data backing the right-side mini chart in district mode:
//   { years, hnPct, ratioOverall, ratioHn, ratioEconDis, ratioEL, ratioSwD,
//     econDisSplit: { freeMeals, reducedPrice },
//     swdSplit: { autism, emotional, intellectual, learning, other, otherHealth, speech } }
//
// ratioOverall / ratioHn read precomputed DB columns (so they include the H8
// proxy + G1+D2 zero-reach math). The subgroup ratios are computed here
// against the matching age band; their split arrays are derived the same way
// from the granular count columns.
export function demographicsSeries(series, age) {
  const empty = {
    years: [], hnPct: [], ratioOverall: [], ratioHn: [],
    ratioEconDis: [], ratioEL: [], ratioSwD: [],
    econDisSplit: { freeMeals: [], reducedPrice: [] },
    swdSplit: {
      autism: [], emotional: [], intellectual: [], learning: [],
      other: [], otherHealth: [], speech: [],
    },
  }
  if (!series || series.length === 0) return empty
  const sorted = [...series].sort((a, b) => a.year - b.year)
  const ratioField   = ratioFieldName('overall', age)
  const ratioHnField = ratioFieldName('hn',      age)

  const out = {
    years:        sorted.map(r => r.year),
    hnPct:        sorted.map(r => r.doe_high_needs_pct ?? null),
    ratioOverall: sorted.map(r => r[ratioField] ?? null),
    ratioHn:      sorted.map(r => r[ratioHnField] ?? null),
    ratioEconDis: sorted.map(r => subgroupRatio(r, age, 'doe_econ_dis_count')),
    ratioEL:      sorted.map(r => subgroupRatio(r, age, 'doe_english_learner_count')),
    ratioSwD:     sorted.map(r => subgroupRatio(r, age, 'doe_swd_count')),
    econDisSplit: {
      freeMeals:    sorted.map(r => subgroupRatio(r, age, 'doe_free_meals_count')),
      reducedPrice: sorted.map(r => subgroupRatio(r, age, 'doe_reduced_price_count')),
    },
    swdSplit: {
      autism:       sorted.map(r => subgroupRatio(r, age, 'doe_swd_autism_count')),
      emotional:    sorted.map(r => subgroupRatio(r, age, 'doe_swd_emotional_count')),
      intellectual: sorted.map(r => subgroupRatio(r, age, 'doe_swd_intellectual_count')),
      learning:     sorted.map(r => subgroupRatio(r, age, 'doe_swd_learning_count')),
      other:        sorted.map(r => subgroupRatio(r, age, 'doe_swd_other_count')),
      otherHealth:  sorted.map(r => subgroupRatio(r, age, 'doe_swd_other_health_count')),
      speech:       sorted.map(r => subgroupRatio(r, age, 'doe_swd_speech_count')),
    },
  }
  return out
}
