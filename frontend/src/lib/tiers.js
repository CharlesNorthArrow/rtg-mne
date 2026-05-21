// Single source of truth for tier presentation
// Diverging RdBu (ColorBrewer 6-class): dark red (no reach) → dark blue (very high).
// Used by map, charts, chips, and legend.

export const TIER_CONFIG = {
  null: { label: 'No data',   mapColor: '#E5E7EB', stripe: true, textColor: 'var(--color-text-secondary)' },
  0:    { label: 'No reach',  mapColor: '#B2182B', textColor: '#FFFFFF' },
  1:    { label: 'Very low',  mapColor: '#EF8A62', textColor: 'var(--color-text-primary)' },
  2:    { label: 'Low',       mapColor: '#FDDBC7', textColor: 'var(--color-text-primary)' },
  3:    { label: 'Moderate',  mapColor: '#D1E5F0', textColor: 'var(--color-text-primary)' },
  4:    { label: 'High',      mapColor: '#67A9CF', textColor: '#FFFFFF' },
  5:    { label: 'Very high', mapColor: '#2166AC', textColor: '#FFFFFF' },
}

export const TIER_LABELS = Object.fromEntries(
  Object.entries(TIER_CONFIG).map(([k, v]) => [k, v.label])
)

export const TIER_KEYS = [0, 1, 2, 3, 4, 5]

export function getTierConfig(tier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG[null]
}

export function getTierColor(tier) {
  return getTierConfig(tier).mapColor
}

export function getTierTextColor(tier) {
  return getTierConfig(tier).textColor
}

// ── Client-side tier assignment ─────────────────────────────────────────
// Mirrors backend/src/services/pipeline.js#assignOverallTier / assignHnTier.
// Used by the dashboard when the active age bracket is 0–4 or 5–9 — tiers
// for those aren't pre-computed in the DB. Thresholds match the defaults
// in supabase/schema.sql pipeline_config row. If you change thresholds in
// the DB, mirror them here.
export const TIER_THRESHOLDS = {
  overall: { t1: 0.010, t2: 0.030, t3: 0.135, t4: 0.500 },
  hn:      { t1: 0.030, t2: 0.080, t3: 0.270, t4: 1.000 },
}

export function assignTier(ratio, metric) {
  if (ratio == null || isNaN(ratio)) return null
  if (ratio === 0) return 0
  const t = TIER_THRESHOLDS[metric] || TIER_THRESHOLDS.overall
  if (metric === 'hn') {
    if (ratio < t.t1) return 1
    if (ratio < t.t2) return 2
    if (ratio < t.t3) return 3
    if (ratio <= t.t4) return 4
    return 5
  }
  if (ratio <= t.t1) return 1
  if (ratio <= t.t2) return 2
  if (ratio <= t.t3) return 3
  if (ratio <= t.t4) return 4
  return 5
}

// ── Ratio / tier field resolvers (age + metric) ──────────────────────────
// age: '0_4' | '0_9' | '5_9'
export const AGE_BRACKETS = ['0_4', '0_9', '5_9']
export const AGE_LABELS = { '0_4': '0–4', '0_9': '0–9', '5_9': '5–9' }

export function ratioFieldName(metric, age) {
  return `ratio_${age}${metric === 'hn' ? '_hn' : ''}`
}

export function preComputedTierField(metric, age) {
  // Only 0_9 has pre-computed tiers in the panel data
  if (age !== '0_9') return null
  return metric === 'hn' ? 'tier_hn' : 'tier_overall'
}

// Age-coefficient defaults. Same mirror pattern as TIER_THRESHOLDS: source of
// truth is pipeline_config in Supabase. Mirror here if changed via /admin/config.
// Invariant enforced by validateCoefficients: coeff_0_4 + coeff_5_9 = coeff_0_9.
export const TIER_COEFFICIENTS = {
  coeff_0_9: 0.80,
  coeff_0_4: 0.48,
  coeff_5_9: 0.32,
}

// Overall tier thresholds (reference — source of truth is pipeline_config in DB)
export const OVERALL_THRESHOLDS = [
  { tier: 0, label: 'No reach',  range: '= 0' },
  { tier: 1, label: 'Very low',  range: '0 < BPC ≤ 0.010' },
  { tier: 2, label: 'Low',       range: '0.010 < BPC ≤ 0.030' },
  { tier: 3, label: 'Moderate',  range: '0.030 < BPC ≤ 0.135' },
  { tier: 4, label: 'High',      range: '0.135 < BPC ≤ 0.500' },
  { tier: 5, label: 'Very high', range: 'BPC > 0.500' },
]

export const HN_THRESHOLDS = [
  { tier: 0, label: 'No reach',  range: '= 0' },
  { tier: 1, label: 'Very low',  range: '0 < BPC < 0.030' },
  { tier: 2, label: 'Low',       range: '0.030 ≤ BPC < 0.080' },
  { tier: 3, label: 'Moderate',  range: '0.080 ≤ BPC < 0.270' },
  { tier: 4, label: 'High',      range: '0.270 ≤ BPC ≤ 1.000' },
  { tier: 5, label: 'Very high', range: 'BPC > 1.000' },
]
