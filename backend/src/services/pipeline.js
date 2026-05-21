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

  // G1+D2 zero-reach sub-rule (see docs/ASSUMPTIONS.md §G1+D2):
  // zero books reach zero of anyone — including high-needs children — so
  // all six ratios are 0 when rolling=0 and we know the district has
  // children. The slice-specific denominator (HN %, age subset) being
  // unavailable does NOT make zero-reach unmeasurable.
  const zeroReach = (books === 0 && p09 != null && p09 > 0)

  const ratio_0_9    = zeroReach ? 0 : safe(books * config.coeff_0_9, p09)
  const ratio_0_4    = zeroReach ? 0 : safe(books * config.coeff_0_4, p04)
  const ratio_5_9    = zeroReach ? 0 : safe(books * config.coeff_5_9, p59)
  const ratio_0_9_hn = zeroReach ? 0 : safe(books * config.coeff_0_9, p09 && hn ? p09 * hn : null)
  const ratio_0_4_hn = zeroReach ? 0 : safe(books * config.coeff_0_4, p04 && hn ? p04 * hn : null)
  const ratio_5_9_hn = zeroReach ? 0 : safe(books * config.coeff_5_9, p59 && hn ? p59 * hn : null)

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

// ── Census proxy carry-forward ─────────────────────────────────────────────
// DECISION: H8 — see docs/ASSUMPTIONS.md
// Carry forward most recent ACS vintage as denominator when target year's
// ACS is unavailable. Cap at one-year gap; refuse further carry-forward.
// TODO(census-2025-release): remove proxy for 2025 once ACS vintage 2024
// is published (~Dec 2026).
//
// Scans district_tiers for `year`, finds rows that have books data but no
// census, and proxies the census forward from the most recent prior year
// where the same geoid has REAL (non-proxy) census data — only if the gap
// is ≤ 1. Proxies do not chain. Ratios + tiers are recomputed for proxied
// rows using the carried-forward denominator.
//
// Returns: { proxied: number, skipped_gap: number, skipped_no_prior: number }
export async function applyProxyCensus({ supabase, year, config }) {
  const stats = { proxied: 0, skipped_gap: 0, skipped_no_prior: 0 }

  // Candidates: rows for `year` with books but no real census.
  // name + county are pulled because the upsert path must satisfy their
  // NOT NULL constraints — Postgres validates the INSERT-shape row before
  // ON CONFLICT resolution, even when we intend to UPDATE.
  const { data: candidates, error: candErr } = await supabase
    .from('district_tiers')
    .select('school_district_geoid, school_district_name, county, year, rolling_3yr_combined, doe_high_needs_pct, census_pop_0_9, census_is_proxy')
    .eq('year', year)
    .is('census_pop_0_9', null)
    .not('rolling_3yr_combined', 'is', null)

  if (candErr) throw candErr
  if (!candidates || candidates.length === 0) return stats

  // For each candidate, find the most recent prior year of REAL census data.
  // Doing this one-by-one keeps the query simple and the count is small (one CT cohort).
  const updates = []
  for (const c of candidates) {
    const { data: source } = await supabase
      .from('district_tiers')
      .select('year, census_pop_0_4, census_pop_5_9, census_pop_0_9')
      .eq('school_district_geoid', c.school_district_geoid)
      .lt('year', year)
      .eq('census_is_proxy', false)
      .not('census_pop_0_9', 'is', null)
      .order('year', { ascending: false })
      .limit(1)

    const src = source?.[0]
    if (!src) { stats.skipped_no_prior += 1; continue }
    if (year - src.year > 1) { stats.skipped_gap += 1; continue }

    const rowForCalc = {
      rolling_3yr_combined: c.rolling_3yr_combined,
      census_pop_0_4: src.census_pop_0_4,
      census_pop_5_9: src.census_pop_5_9,
      census_pop_0_9: src.census_pop_0_9,
      doe_high_needs_pct: c.doe_high_needs_pct,
    }
    const ratios = computeRatios(rowForCalc, config)

    updates.push({
      school_district_geoid: c.school_district_geoid,
      school_district_name: c.school_district_name,
      county: c.county,
      year,
      census_pop_0_4: src.census_pop_0_4,
      census_pop_5_9: src.census_pop_5_9,
      census_pop_0_9: src.census_pop_0_9,
      census_source_year: src.year,
      census_is_proxy: true,
      ...ratios,
    })
  }

  if (updates.length === 0) return stats

  const { error: upsertErr } = await supabase
    .from('district_tiers')
    .upsert(updates, { onConflict: 'school_district_geoid,year' })
  if (upsertErr) throw upsertErr

  stats.proxied = updates.length
  return stats
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
