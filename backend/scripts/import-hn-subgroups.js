// backend/scripts/import-hn-subgroups.js
// One-shot: import the per-district per-year high-needs subgroup CSV into
// district_tiers. Adds counts for Econ Dis (Free + Reduced), English
// Learners, and Students with Disabilities (with 7 sub-types) on the 158
// districts already in the panel.
//
// Scope: years 2009-2024 (matches the G1+D2 cross-product window).
// District-name match is the same trick used by the live DoE upload route
// in admin.js — strip the trailing " (NNNNNNN)" CSDE code.
//
// Usage:
//   node scripts/import-hn-subgroups.js [/path/to/csv]
// Default path: ../../../Historical Data/CT - School Districts High Needs Subgroups.csv
// (relative to this script).

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'
import { adminSupabase } from '../src/lib/supabase.js'
import { fetchAll } from './_lib.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const YEAR_MIN = 2009
const YEAR_MAX = 2025   // CSV covers through school-year 2025-26 (start year 2025)

// ── 1) Resolve CSV path ────────────────────────────────────────────────
const csvPath = process.argv[2] || path.join(
  __dirname,
  '../../../../Historical Data/CT - School Districts High Needs Subgroups.csv'
)
if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found at ${csvPath}`)
  console.error('Pass the path as the first arg, or place it at the default location.')
  process.exit(1)
}
console.log(`Reading ${csvPath}`)

const csv = fs.readFileSync(csvPath, 'utf8')
const { data: rows, errors } = Papa.parse(csv, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
})
if (errors.length) {
  console.error('CSV parse errors:', errors.slice(0, 5))
  process.exit(1)
}
console.log(`Parsed ${rows.length} CSV rows`)

// ── 2) Load district name → geoid map ──────────────────────────────────
const knownDistricts = await fetchAll(
  adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, school_district_name, county')
)
const nameToGeoid = {}
const countyByGeoid = {}
for (const d of knownDistricts) {
  if (!nameToGeoid[d.school_district_name]) {
    nameToGeoid[d.school_district_name] = d.school_district_geoid
  }
  if (d.county && !countyByGeoid[d.school_district_geoid]) {
    countyByGeoid[d.school_district_geoid] = d.county
  }
}
console.log(`Loaded ${Object.keys(nameToGeoid).length} known districts from DB`)

// ── 3) Build upsert payloads ───────────────────────────────────────────
const parseYear = (sy) => {
  if (!sy || typeof sy !== 'string') return null
  const m = sy.match(/^(\d{4})/)
  return m ? parseInt(m[1]) : null
}
const stripCode = (raw) => (raw ?? '').toString().replace(/\s*\(\d+\)\s*$/, '').trim()
const num = (v) => (v === '' || v == null || (typeof v === 'string' && v.toLowerCase() === 'nan')) ? null : Number(v)

const upserts = []
let outOfRange = 0
const unmatchedNames = new Set()
const crossCheckDeltas = []   // | csv_hn - db_hn | sample

for (const r of rows) {
  const year = parseYear(r['School Year'])
  if (year == null) continue
  if (year < YEAR_MIN || year > YEAR_MAX) { outOfRange++; continue }

  const name = r.District_Name || stripCode(r.District)
  const geoid = nameToGeoid[name]
  if (!geoid) { unmatchedNames.add(name); continue }

  const free     = num(r.Free_Meals)
  const reduced  = num(r.Reduced_Price_Meals)
  const econDis  = (free == null && reduced == null) ? null : (free ?? 0) + (reduced ?? 0)

  upserts.push({
    school_district_geoid:       geoid,
    school_district_name:        name,
    county:                      countyByGeoid[geoid],
    year,
    doe_econ_dis_count:          econDis,
    doe_free_meals_count:        free,
    doe_reduced_price_count:     reduced,
    doe_english_learner_count:   num(r.English_Learners),
    doe_swd_count:               num(r.SWD_Total),
    doe_swd_autism_count:        num(r.SWD_Autism),
    doe_swd_emotional_count:     num(r.SWD_Emotional),
    doe_swd_intellectual_count:  num(r.SWD_Intellectual),
    doe_swd_learning_count:      num(r.SWD_Learning),
    doe_swd_other_count:         num(r.SWD_Other),
    doe_swd_other_health_count:  num(r.SWD_OtherHealthImp),
    doe_swd_speech_count:        num(r.SWD_SpeechLanguage),
  })

  const csvHn = num(r.High_Needs)
  if (csvHn != null) crossCheckDeltas.push({ geoid, year, csvHn })
}

console.log(`\nUpsert payloads: ${upserts.length}`)
console.log(`Out-of-range rows skipped (year < ${YEAR_MIN} or > ${YEAR_MAX}): ${outOfRange}`)
console.log(`Distinct unmatched names: ${unmatchedNames.size} (charter/magnet/regional centres expected to be skipped)`)
if (unmatchedNames.size > 0 && unmatchedNames.size <= 60) {
  console.log('  Unmatched:', [...unmatchedNames].sort().slice(0, 20).map(n => `\n    - ${n}`).join(''))
  if (unmatchedNames.size > 20) console.log(`    … (${unmatchedNames.size - 20} more)`)
}

if (upserts.length === 0) {
  console.log('\nNothing to write.')
  process.exit(0)
}

// ── 4) Upsert in batches ───────────────────────────────────────────────
const BATCH = 500
let written = 0
for (let i = 0; i < upserts.length; i += BATCH) {
  const slice = upserts.slice(i, i + BATCH)
  const { error } = await adminSupabase
    .from('district_tiers')
    .upsert(slice, { onConflict: 'school_district_geoid,year' })
  if (error) {
    console.error(`Batch starting at ${i} failed:`, error.message)
    process.exit(1)
  }
  written += slice.length
  console.log(`  wrote ${written} / ${upserts.length}`)
}

// ── 5) Cross-check CSV High_Needs against DB doe_high_needs_count ──────
const sampleSize = Math.min(crossCheckDeltas.length, 200)
console.log(`\nCross-checking ${sampleSize} rows: CSV High_Needs vs DB doe_high_needs_count`)
const sample = crossCheckDeltas.slice(0, sampleSize)
const sampleGeoids = [...new Set(sample.map(s => s.geoid))]
const { data: dbRows } = await adminSupabase
  .from('district_tiers')
  .select('school_district_geoid, year, doe_high_needs_count')
  .in('school_district_geoid', sampleGeoids)
const dbHn = new Map()
for (const r of dbRows || []) dbHn.set(`${r.school_district_geoid}:${r.year}`, r.doe_high_needs_count)
let big = 0
let totalAbs = 0
let n = 0
for (const s of sample) {
  const db = dbHn.get(`${s.geoid}:${s.year}`)
  if (db == null) continue
  const delta = Math.abs(s.csvHn - db)
  totalAbs += delta
  n++
  if (delta > 5) big++
}
if (n > 0) {
  console.log(`  mean |Δ| = ${(totalAbs / n).toFixed(2)}; ${big}/${n} rows with |Δ| > 5`)
} else {
  console.log('  (no overlapping DB rows had non-null doe_high_needs_count to compare against)')
}

console.log('\nDone.')
