// backend/scripts/expand-panel.js
// One-shot: enforce the G1+D2 rule by backfilling missing (district, year)
// cells in district_tiers as books=0, tier_overall=0. See
// docs/ASSUMPTIONS.md §G1+D2.
//
// Scope: years 2009-2024 only. Districts: the 158 in the composite GeoJSON.
//
// Usage:
//   node scripts/expand-panel.js [/path/to/census_pop_by_sd_year.csv]
// Default census CSV path is "../../Data Pull/census_pop_by_sd_year.csv"
// relative to this script.

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'
import { adminSupabase } from '../src/lib/supabase.js'
import { computeRatios } from '../src/services/pipeline.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const YEAR_MIN = 2009
const YEAR_MAX = 2024

// Norfolk + RSD 12 don't have any rows in the DB, so county can't be
// looked up there. Both are in Litchfield County, CT.
const COUNTY_FALLBACK = {
  '0902940': 'Litchfield County',  // Norfolk School District
  '0903530': 'Litchfield County',  // Regional School District 12
}

// ── 1) Load composite GeoJSON ──────────────────────────────────────────
const geoPath = path.join(__dirname, '../data/composite_unsd_elsd.geojson')
const geojson = JSON.parse(fs.readFileSync(geoPath, 'utf8'))
const districts = geojson.features.map(f => ({
  geoid:   f.properties.GEOID,
  name:    f.properties.NAME,
  sd_type: f.properties.sd_type,
}))
console.log(`GeoJSON: ${districts.length} districts`)

// ── 2) Load census CSV ─────────────────────────────────────────────────
const csvPath = process.argv[2] || path.join(__dirname, '../../../../Data Pull/census_pop_by_sd_year.csv')
if (!fs.existsSync(csvPath)) {
  console.error(`Census CSV not found at ${csvPath}`)
  console.error('Pass the path as the first arg, or place it at the default location.')
  process.exit(1)
}
const censusCsv = fs.readFileSync(csvPath, 'utf8')
const { data: censusRows } = Papa.parse(censusCsv, {
  header: true,
  dynamicTyping: h => h !== 'school_district_geoid',
  skipEmptyLines: true,
})

const census = new Map()  // "geoid:year" -> { pop_0_4, pop_5_9, pop_0_9 }
for (const r of censusRows) {
  if (!r.school_district_geoid || r.school_district_geoid === '0999998') continue
  const y = parseInt(r.year)
  if (y < YEAR_MIN || y > YEAR_MAX) continue
  census.set(`${r.school_district_geoid}:${y}`, {
    pop_0_4: r.census_pop_0_4,
    pop_5_9: r.census_pop_5_9,
    pop_0_9: r.census_pop_0_9,
  })
}
console.log(`Census CSV: ${census.size} (geoid, year) cells in [${YEAR_MIN}-${YEAR_MAX}]`)

// ── 3) Load existing DB rows for 2009-2024 ─────────────────────────────
async function fetchAll(query) {
  const PAGE = 1000
  const out = []
  let offset = 0
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}

const existing = await fetchAll(
  adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, year, books_combined, census_pop_0_9, tier_overall, county')
    .gte('year', YEAR_MIN)
    .lte('year', YEAR_MAX)
)

const existingKeys = new Set(existing.map(r => `${r.school_district_geoid}:${r.year}`))
const countyByGeoid = {}
for (const r of existing) {
  if (r.county && !countyByGeoid[r.school_district_geoid]) {
    countyByGeoid[r.school_district_geoid] = r.county
  }
}
for (const [g, c] of Object.entries(COUNTY_FALLBACK)) {
  if (!countyByGeoid[g]) countyByGeoid[g] = c
}

console.log(`DB: ${existing.length} existing rows in [${YEAR_MIN}-${YEAR_MAX}]`)

// ── 4) Pre-fix breakdown ───────────────────────────────────────────────
function bucket(rows) {
  let zero_with_demo_tier0 = 0
  let pos_with_demo_tier = 0
  let any_no_demo = 0
  let other = 0
  for (const r of rows) {
    const b = r.books_combined
    const hasDemo = r.census_pop_0_9 != null
    if (!hasDemo) any_no_demo++
    else if (b === 0 && r.tier_overall === 0) zero_with_demo_tier0++
    else if (b > 0 && r.tier_overall != null) pos_with_demo_tier++
    else other++
  }
  return { zero_with_demo_tier0, pos_with_demo_tier, any_no_demo, other }
}
console.log('\nPre-fix bucketing of existing rows:')
console.log('  ' + JSON.stringify(bucket(existing)))

// ── 5) Compute gap cells ───────────────────────────────────────────────
const config = await (async () => {
  const { data, error } = await adminSupabase.from('pipeline_config').select('*').single()
  if (error) throw error
  return data
})()

const inserts = []
const missingCensus = []
for (const d of districts) {
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    const key = `${d.geoid}:${y}`
    if (existingKeys.has(key)) continue
    const c = census.get(key)
    if (!c) { missingCensus.push(key); continue }

    const county = countyByGeoid[d.geoid]
    if (!county) {
      console.warn(`No county for ${d.geoid} (${d.name}); skipping ${y}`)
      continue
    }

    const rowForCalc = {
      rolling_3yr_combined: 0,
      census_pop_0_4: c.pop_0_4,
      census_pop_5_9: c.pop_5_9,
      census_pop_0_9: c.pop_0_9,
      doe_high_needs_pct: null,
    }
    const ratios = computeRatios(rowForCalc, config)

    inserts.push({
      school_district_geoid: d.geoid,
      school_district_name:  d.name,
      sd_type:               d.sd_type,
      county,
      year:                  y,
      books_bfk:             0,
      books_bookmobile:      0,
      books_combined:        0,
      rolling_3yr_bfk:       0,
      rolling_3yr_bookmobile:0,
      rolling_3yr_combined:  0,
      doe_total_enrollment:  null,
      doe_high_needs_count:  null,
      doe_high_needs_pct:    null,
      census_pop_0_4:        c.pop_0_4,
      census_pop_5_9:        c.pop_5_9,
      census_pop_0_9:        c.pop_0_9,
      census_source_year:    y,
      census_is_proxy:       false,
      ...ratios,
    })
  }
}

console.log(`\nGap cells to insert: ${inserts.length}`)
if (missingCensus.length) {
  console.warn(`Cells skipped (no census for that geoid+year): ${missingCensus.length}`)
  console.warn('  first few:', missingCensus.slice(0, 5))
}

if (inserts.length === 0) {
  console.log('Nothing to insert.')
  process.exit(0)
}

// ── 6) Insert in batches ───────────────────────────────────────────────
const BATCH = 500
let written = 0
for (let i = 0; i < inserts.length; i += BATCH) {
  const slice = inserts.slice(i, i + BATCH)
  const { error } = await adminSupabase
    .from('district_tiers')
    .upsert(slice, { onConflict: 'school_district_geoid,year' })
  if (error) {
    console.error(`Batch ${i} failed:`, error.message)
    process.exit(1)
  }
  written += slice.length
  console.log(`  wrote ${written} / ${inserts.length}`)
}

// ── 7) Post-fix verification ───────────────────────────────────────────
const after = await fetchAll(
  adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, year, books_combined, census_pop_0_9, tier_overall')
    .gte('year', YEAR_MIN)
    .lte('year', YEAR_MAX)
)
console.log(`\nPost-fix: ${after.length} rows in [${YEAR_MIN}-${YEAR_MAX}] (expected ${districts.length * (YEAR_MAX - YEAR_MIN + 1)})`)
console.log('Post-fix bucketing:')
console.log('  ' + JSON.stringify(bucket(after)))

// Spot checks
function checkDistrict(geoid, label) {
  const rows = after.filter(r => r.school_district_geoid === geoid)
  const tier0 = rows.filter(r => r.tier_overall === 0).length
  console.log(`  ${label} (${geoid}): ${rows.length} rows in 2009-2024, ${tier0} with tier_overall=0`)
}
checkDistrict('0902940', 'Norfolk SD')
checkDistrict('0903530', 'RSD 12')
const y2009 = after.filter(r => r.year === 2009).length
console.log(`  Year 2009 row count: ${y2009} (expected ${districts.length})`)

console.log('\nDone.')
