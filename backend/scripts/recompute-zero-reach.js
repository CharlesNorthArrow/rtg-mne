// backend/scripts/recompute-zero-reach.js
// One-shot: recompute ratios + tiers for zero-reach rows so the math fix
// in computeRatios takes effect on existing data. See
// docs/ASSUMPTIONS.md §G1+D2 "Zero-reach across slices".
//
// Scope: rows where rolling_3yr_combined = 0 AND census_pop_0_9 > 0 AND
// (tier_hn IS NULL OR ratio_0_9_hn IS NULL). These are the rows whose
// HN tier was previously null because the DoE denominator was missing.
//
// Usage: node scripts/recompute-zero-reach.js

import 'dotenv/config'
import { adminSupabase } from '../src/lib/supabase.js'
import { computeRatios } from '../src/services/pipeline.js'
import { fetchAll } from './_lib.js'

const { data: cfg, error: cfgErr } = await adminSupabase
  .from('pipeline_config').select('*').single()
if (cfgErr) {
  console.error('Failed to load pipeline_config:', cfgErr.message)
  process.exit(1)
}

// Pull candidates. Two server-side filters cover the "math fix changes
// outcome" condition; the third (tier_hn IS NULL OR ratio_0_9_hn IS NULL)
// is checked client-side because PostgREST OR syntax is finicky.
const candidates = await fetchAll(
  adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, school_district_name, county, year, rolling_3yr_combined, doe_high_needs_pct, census_pop_0_4, census_pop_5_9, census_pop_0_9, ratio_0_9_hn, tier_hn')
    .eq('rolling_3yr_combined', 0)
    .gt('census_pop_0_9', 0)
)

const targets = candidates.filter(r => r.tier_hn === null || r.ratio_0_9_hn === null)
console.log(`Candidates (rolling=0, p09>0): ${candidates.length}`)
console.log(`Targets   (tier_hn null OR ratio_hn null): ${targets.length}`)

if (targets.length === 0) {
  console.log('Nothing to recompute.')
  process.exit(0)
}

// Build updates
const updates = targets.map(row => {
  const ratios = computeRatios({
    rolling_3yr_combined: row.rolling_3yr_combined,
    census_pop_0_4:       row.census_pop_0_4,
    census_pop_5_9:       row.census_pop_5_9,
    census_pop_0_9:       row.census_pop_0_9,
    doe_high_needs_pct:   row.doe_high_needs_pct,
  }, cfg)
  return {
    school_district_geoid: row.school_district_geoid,
    school_district_name:  row.school_district_name,
    county:                row.county,
    year:                  row.year,
    ...ratios,
  }
})

const BATCH = 500
let written = 0
for (let i = 0; i < updates.length; i += BATCH) {
  const slice = updates.slice(i, i + BATCH)
  const { error } = await adminSupabase
    .from('district_tiers')
    .upsert(slice, { onConflict: 'school_district_geoid,year' })
  if (error) { console.error(`Batch ${i} failed:`, error.message); process.exit(1) }
  written += slice.length
  console.log(`  wrote ${written} / ${updates.length}`)
}

// Verify the flip
const after = await fetchAll(
  adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, year, tier_hn, ratio_0_9_hn')
    .in('school_district_geoid', [...new Set(targets.map(t => t.school_district_geoid))])
)
const flippedToZero = after.filter(r => r.tier_hn === 0 && targets.some(t => t.school_district_geoid === r.school_district_geoid && t.year === r.year)).length
console.log(`\nVerified: ${flippedToZero} target rows now have tier_hn = 0.`)

console.log('Done.')
