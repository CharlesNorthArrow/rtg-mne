// backend/scripts/apply-proxy-census.js
// One-shot: fire H8 census proxy carry-forward for every year that already
// has books data but no census. Use this after seeding from a CSV that
// includes years past the latest available ACS vintage (e.g. 2025).
//
// See docs/ASSUMPTIONS.md §H8.
//
// Usage: node scripts/apply-proxy-census.js

import 'dotenv/config'
import { adminSupabase } from '../src/lib/supabase.js'
import { applyProxyCensus } from '../src/services/pipeline.js'

const { data: cfg, error: cfgErr } = await adminSupabase
  .from('pipeline_config').select('*').single()
if (cfgErr) {
  console.error('Failed to load pipeline_config:', cfgErr.message)
  process.exit(1)
}

// Find every year that has books but no census (the proxy candidates)
const { data: gapRows, error: gapErr } = await adminSupabase
  .from('district_tiers')
  .select('year')
  .is('census_pop_0_9', null)
  .not('rolling_3yr_combined', 'is', null)
if (gapErr) {
  console.error('Failed to scan for gap years:', gapErr.message)
  process.exit(1)
}

const years = [...new Set((gapRows || []).map(r => r.year))].sort((a, b) => a - b)
console.log(`Found gap years: [${years.join(', ')}]`)

if (years.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

for (const year of years) {
  const stats = await applyProxyCensus({ supabase: adminSupabase, year, config: cfg })
  console.log(`${year} → ${JSON.stringify(stats)}`)
}

// Boundary check — must be 0 per H8 scope cap
const { data: violations } = await adminSupabase
  .from('district_tiers')
  .select('school_district_geoid, year, census_source_year')
  .eq('census_is_proxy', true)

const bad = (violations || []).filter(r => r.year - r.census_source_year > 1)
console.log(`Boundary check (year - source_year > 1): ${bad.length} rows. ${bad.length === 0 ? '✓' : '✗'}`)
if (bad.length > 0) {
  console.log('Violations:', bad.slice(0, 5))
}

console.log('Done.')
