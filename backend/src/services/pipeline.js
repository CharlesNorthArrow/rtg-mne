// Pipeline computation service
// All ratio and tier logic lives here — single source of truth

// ── Tier assignment ────────────────────────────────────────────────────────
export function assignOverallTier(ratio, config) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return null
  if (ratio === 0) return 0
  if (ratio <= config.tier_overall_t1) return 1
  if (ratio <= config.tier_overall_t2) return 2
  if (ratio <= config.tier_overall_t3) return 3
  if (ratio <= config.tier_overall_t4) return 4
  return 5
}

export function assignHnTier(ratio, config) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return null
  if (ratio === 0) return 0
  if (ratio < config.tier_hn_t1) return 1
  if (ratio < config.tier_hn_t2) return 2
  if (ratio < config.tier_hn_t3) return 3
  if (ratio <= config.tier_hn_t4) return 4
  return 5
}

// ── Ratio computation ──────────────────────────────────────────────────────
export function computeRatios(row, config) {
  const books = row.rolling_3yr_combined
  const p09   = row.census_pop_0_9
  const p04   = row.census_pop_0_4
  const p59   = row.census_pop_5_9
  const hn    = row.doe_high_needs_pct

  const safe = (num, den) => {
    if (num === null || den === null || den === 0) return null
    return num / den
  }

  const ratio_0_9    = safe(books * config.coeff_0_9, p09)
  const ratio_0_4    = safe(books * config.coeff_0_4, p04)
  const ratio_5_9    = safe(books * config.coeff_5_9, p59)
  const ratio_0_9_hn = safe(books * config.coeff_0_9, p09 && hn ? p09 * hn : null)
  const ratio_0_4_hn = safe(books * config.coeff_0_4, p04 && hn ? p04 * hn : null)
  const ratio_5_9_hn = safe(books * config.coeff_5_9, p59 && hn ? p59 * hn : null)

  return {
    ratio_0_9,
    ratio_0_4,
    ratio_5_9,
    ratio_0_9_hn,
    ratio_0_4_hn,
    ratio_5_9_hn,
    tier_overall: assignOverallTier(ratio_0_9, config),
    tier_hn:      assignHnTier(ratio_0_9_hn, config),
  }
}

// ── Rolling 3-year average ─────────────────────────────────────────────────
// priorRows: array of up to 2 prior-year rows [{year, books_combined}]
// currentBooks: raw books for the new year
export function computeRollingAvg(priorRows, currentBooks) {
  // Always divide by 3, treating missing prior years as 0
  const values = [0, 0, currentBooks]  // slots: t-2, t-1, t
  const sorted = [...priorRows].sort((a, b) => b.year - a.year) // most recent first

  if (sorted[0]) values[1] = sorted[0].books_combined || 0
  if (sorted[1]) values[0] = sorted[1].books_combined || 0

  return (values[0] + values[1] + values[2]) / 3
}

// ── Coefficient validation ─────────────────────────────────────────────────
export function validateCoefficients(coeff_0_9, coeff_0_4, coeff_5_9) {
  const sum = parseFloat((coeff_0_4 + coeff_5_9).toFixed(10))
  const target = parseFloat(coeff_0_9.toFixed(10))
  if (Math.abs(sum - target) > 0.0001) {
    return { valid: false, message: `coeff_0_4 (${coeff_0_4}) + coeff_5_9 (${coeff_5_9}) must equal coeff_0_9 (${coeff_0_9})` }
  }
  return { valid: true }
}
