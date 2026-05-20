// Single source of truth for tier presentation
// Used by map, legend, table, and detail panel

// Sequential white→navy ramp. Intensity grows with reach.
// "No data" stays grey so it reads as distinct from tier 0 (white = no reach).
export const TIER_CONFIG = {
  null: { label: 'No data',   color: '#E5E7EB', textColor: '#6B7280', mapColor: '#E5E7EB' },
  0:    { label: 'No Reach',  color: '#FFFFFF', textColor: '#1F2937', mapColor: '#FFFFFF' },
  1:    { label: 'Very Low',  color: '#D6E6F4', textColor: '#1F2937', mapColor: '#D6E6F4' },
  2:    { label: 'Low',       color: '#9BC4E2', textColor: '#1F2937', mapColor: '#9BC4E2' },
  3:    { label: 'Moderate',  color: '#5295C5', textColor: '#FFFFFF', mapColor: '#5295C5' },
  4:    { label: 'High',      color: '#1D61A4', textColor: '#FFFFFF', mapColor: '#1D61A4' },
  5:    { label: 'Very High', color: '#08306B', textColor: '#FFFFFF', mapColor: '#08306B' },
}

export const TIER_LABELS = Object.fromEntries(
  Object.entries(TIER_CONFIG).map(([k, v]) => [k, v.label])
)

// Overall tier thresholds (reference — source of truth is pipeline_config in DB)
export const OVERALL_THRESHOLDS = [
  { tier: 0, label: 'No Reach',           range: '= 0' },
  { tier: 1, label: 'Very Low',           range: '0 < BPC ≤ 0.010' },
  { tier: 2, label: 'Low',                range: '0.010 < BPC ≤ 0.030' },
  { tier: 3, label: 'Moderate',           range: '0.030 < BPC ≤ 0.135' },
  { tier: 4, label: 'High',               range: '0.135 < BPC ≤ 0.500' },
  { tier: 5, label: 'Very High', range: 'BPC > 0.500' },
]

export const HN_THRESHOLDS = [
  { tier: 0, label: 'No Reach',           range: '= 0' },
  { tier: 1, label: 'Very Low',           range: '0 < BPC < 0.030' },
  { tier: 2, label: 'Low',                range: '0.030 ≤ BPC < 0.080' },
  { tier: 3, label: 'Moderate',           range: '0.080 ≤ BPC < 0.270' },
  { tier: 4, label: 'High',               range: '0.270 ≤ BPC ≤ 1.000' },
  { tier: 5, label: 'Very High', range: 'BPC > 1.000' },
]

export function getTierConfig(tier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG[null]
}

export function getTierColor(tier) {
  return getTierConfig(tier).mapColor
}
