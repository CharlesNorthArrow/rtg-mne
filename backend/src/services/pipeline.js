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

  // G1+D2 zero-reach sub-rule (see docs/ASSUMPTIONS.md §G1+D2):
  // zero books with a known child population is a real measurement of "no
  // reach" against every slice, regardless of slice-specific denominators.
  if (books === 0 && p09 != null && p09 > 0) {
    return {
      ratio_0_9: 0, ratio_0_4: 0, ratio_5_9: 0,
      ratio_0_9_hn: 0, ratio_0_4_hn: 0, ratio_5_9_hn: 0,
      tier_overall: 0, tier_hn: 0,
    }
  }

  const safe = (num, den) => {
    if (num === null || den === null || den === 0) return null
    return num / den
  }

  const ratio_0_9    = safe(books * config.coeff_0_9, p09)
  const ratio_0_9_hn = safe(books * config.coeff_0_9, p09 && hn ? p09 * hn : null)

  return {
    ratio_0_9,
    ratio_0_4:    safe(books * config.coeff_0_4, p04),
    ratio_5_9:    safe(books * config.coeff_5_9, p59),
    ratio_0_9_hn,
    ratio_0_4_hn: safe(books * config.coeff_0_4, p04 && hn ? p04 * hn : null),
    ratio_5_9_hn: safe(books * config.coeff_5_9, p59 && hn ? p59 * hn : null),
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
//
// Returns: { proxied: number, skipped_gap: number, skipped_no_prior: number }
export async function applyProxyCensus({ supabase, year, config }) {
  const stats = { proxied: 0, skipped_gap: 0, skipped_no_prior: 0 }

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

  // One batch query for all candidates' source rows. We pull all prior
  // real-vintage rows for the geoids in scope, then in JS pick the most
  // recent per geoid.
  const geoids = candidates.map(c => c.school_district_geoid)
  const { data: sources, error: srcErr } = await supabase
    .from('district_tiers')
    .select('school_district_geoid, year, census_pop_0_4, census_pop_5_9, census_pop_0_9')
    .in('school_district_geoid', geoids)
    .lt('year', year)
    .eq('census_is_proxy', false)
    .not('census_pop_0_9', 'is', null)
    .order('year', { ascending: false })

  if (srcErr) throw srcErr

  const latestSourceByGeoid = new Map()
  for (const s of sources || []) {
    if (!latestSourceByGeoid.has(s.school_district_geoid)) {
      latestSourceByGeoid.set(s.school_district_geoid, s)
    }
  }

  const updates = []
  for (const c of candidates) {
    const src = latestSourceByGeoid.get(c.school_district_geoid)
    if (!src) { stats.skipped_no_prior += 1; continue }
    if (year - src.year > 1) { stats.skipped_gap += 1; continue }

    const ratios = computeRatios({
      rolling_3yr_combined: c.rolling_3yr_combined,
      census_pop_0_4: src.census_pop_0_4,
      census_pop_5_9: src.census_pop_5_9,
      census_pop_0_9: src.census_pop_0_9,
      doe_high_needs_pct: c.doe_high_needs_pct,
    }, config)

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
