// backend/scripts/seed.js
// Run once to seed district_tiers from books_by_sd_year.csv
// Usage: node scripts/seed.js /path/to/books_by_sd_year.csv

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/seed.js /path/to/books_by_sd_year.csv')
  process.exit(1)
}

const csv = fs.readFileSync(csvPath, 'utf8')
const { data, errors } = Papa.parse(csv, {
  header: true,
  // Keep school_district_geoid as a string — leading zeros (e.g. "0900030") must survive
  dynamicTyping: header => header !== 'school_district_geoid',
  skipEmptyLines: true,
})

if (errors.length) {
  console.error('CSV parse errors:', errors)
  process.exit(1)
}

console.log(`Parsed ${data.length} rows from CSV`)

// Validate expected columns
const requiredCols = ['school_district_geoid','school_district_name','county','year','tier_overall','tier_hn']
const missing = requiredCols.filter(c => !data[0].hasOwnProperty(c))
if (missing.length) {
  console.error('Missing columns:', missing)
  process.exit(1)
}

// Replace NaN strings with null (papaparse may not handle all edge cases)
const clean = data.map(row => {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = (v === '' || v === 'nan' || v === 'NaN') ? null : v
  }
  return out
})

// Upsert in batches of 500
const BATCH = 500
let seeded = 0

for (let i = 0; i < clean.length; i += BATCH) {
  const batch = clean.slice(i, i + BATCH)
  const { error } = await supabase
    .from('district_tiers')
    .upsert(batch, { onConflict: 'school_district_geoid,year' })

  if (error) {
    console.error(`Error at batch ${i}:`, error.message)
    process.exit(1)
  }

  seeded += batch.length
  console.log(`Seeded ${seeded} / ${clean.length} rows`)
}

console.log(`\nDone. ${clean.length} rows seeded into district_tiers.`)
