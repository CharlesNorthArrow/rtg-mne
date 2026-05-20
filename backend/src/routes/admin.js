import { Router } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { adminSupabase } from '../lib/supabase.js'
import { computeRatios, computeRollingAvg, validateCoefficients } from '../services/pipeline.js'

const router = Router()
const upload = multer({ dest: '/tmp/rtg-uploads/' })

// Load GeoJSON once at startup
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GEO_PATH = path.join(__dirname, '../../data/composite_unsd_elsd.geojson')
const geojson = JSON.parse(fs.readFileSync(GEO_PATH, 'utf8'))

function findDistrict(lat, lon) {
  const pt = point([lon, lat])
  for (const feature of geojson.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return { geoid: feature.properties.GEOID, name: feature.properties.NAME }
    }
  }
  return null
}

async function getConfig() {
  const { data } = await adminSupabase.from('pipeline_config').select('*').single()
  return data
}

async function logRun(type, user, status, details, errorMessage = null) {
  await adminSupabase.from('pipeline_runs').insert({
    run_type: type,
    triggered_by: user.email,
    status,
    details,
    error_message: errorMessage,
  })
}

// ── POST /api/admin/upload-books ──────────────────────────────────────────
router.post('/upload-books', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const csv = fs.readFileSync(file.path, 'utf8')
    const { data: rows } = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true })

    // Determine new year: max year in file not already in DB
    const yearsInFile = [...new Set(rows.map(r => r.Year).filter(Boolean))]
    const { data: existingYears } = await adminSupabase
      .from('district_tiers')
      .select('year')
    const existingYearSet = new Set((existingYears || []).map(r => r.year))
    const newYears = yearsInFile.filter(y => !existingYearSet.has(y))

    if (!newYears.length) {
      return res.status(400).json({ error: 'No new years found in file. All years already exist in database.' })
    }

    const targetYear = Math.max(...newYears)
    const config = await getConfig()

    // Filter: new year, BFK + Bookmobile, has coordinates, CT state preferred
    const filtered = rows.filter(r =>
      r.Year === targetYear &&
      ['Books for Kids', 'books for kids', 'Books for kids', 'Bookmobile'].includes(r.ProgramType) &&
      r.Lat != null && r.Lon != null
    )

    // Spatial join
    const matched = []
    const unmatched = []
    for (const row of filtered) {
      const district = findDistrict(row.Lat, row.Lon)
      if (district) {
        matched.push({ ...row, geoid: district.geoid, district_name: district.name })
      } else {
        unmatched.push(row)
      }
    }

    // Aggregate by geoid + program
    const agg = {}
    for (const row of matched) {
      const key = row.geoid
      if (!agg[key]) agg[key] = { bfk: 0, bookmobile: 0, name: row.district_name }
      const prog = row.ProgramType.toLowerCase().includes('bookmobile') ? 'bookmobile' : 'bfk'
      agg[key][prog] += row.SumOfQty || 0
    }

    // Fetch prior 2 years for rolling avg
    const { data: priorRows } = await adminSupabase
      .from('district_tiers')
      .select('school_district_geoid, year, books_combined')
      .in('year', [targetYear - 1, targetYear - 2])

    const priorByGeoid = {}
    for (const r of (priorRows || [])) {
      if (!priorByGeoid[r.school_district_geoid]) priorByGeoid[r.school_district_geoid] = []
      priorByGeoid[r.school_district_geoid].push(r)
    }

    // Fetch existing DoE + Census for new year
    const { data: existingRows } = await adminSupabase
      .from('district_tiers')
      .select('school_district_geoid, doe_high_needs_pct, census_pop_0_4, census_pop_5_9, census_pop_0_9')
      .eq('year', targetYear)

    const existingByGeoid = Object.fromEntries((existingRows || []).map(r => [r.school_district_geoid, r]))

    // Build upsert rows
    const upsertRows = []
    for (const [geoid, books] of Object.entries(agg)) {
      const bfk        = books.bfk
      const bookmobile = books.bookmobile
      const combined   = bfk + bookmobile
      const prior      = priorByGeoid[geoid] || []
      const rolling    = computeRollingAvg(prior, combined)

      const existing   = existingByGeoid[geoid] || {}
      const rowForCalc = {
        rolling_3yr_combined: rolling,
        census_pop_0_4: existing.census_pop_0_4 ?? null,
        census_pop_5_9: existing.census_pop_5_9 ?? null,
        census_pop_0_9: existing.census_pop_0_9 ?? null,
        doe_high_needs_pct: existing.doe_high_needs_pct ?? null,
      }

      const ratios = computeRatios(rowForCalc, config)

      upsertRows.push({
        school_district_geoid: geoid,
        school_district_name: books.name,
        year: targetYear,
        books_bfk: bfk,
        books_bookmobile: bookmobile,
        books_combined: combined,
        rolling_3yr_bfk: computeRollingAvg(prior, bfk),
        rolling_3yr_bookmobile: computeRollingAvg(prior, bookmobile),
        rolling_3yr_combined: rolling,
        ...ratios,
      })
    }

    // Also insert zero-book rows for districts with no new distributions
    // (needed to maintain complete district × year grid)
    // Fetch all known districts from prior year
    const { data: allDistricts } = await adminSupabase
      .from('district_tiers')
      .select('school_district_geoid, school_district_name, county')
      .eq('year', targetYear - 1)

    const upsertGeoids = new Set(upsertRows.map(r => r.school_district_geoid))
    for (const d of (allDistricts || [])) {
      if (!upsertGeoids.has(d.school_district_geoid)) {
        const prior = priorByGeoid[d.school_district_geoid] || []
        const rolling = computeRollingAvg(prior, 0)
        const existing = existingByGeoid[d.school_district_geoid] || {}
        const rowForCalc = {
          rolling_3yr_combined: rolling,
          census_pop_0_4: existing.census_pop_0_4 ?? null,
          census_pop_5_9: existing.census_pop_5_9 ?? null,
          census_pop_0_9: existing.census_pop_0_9 ?? null,
          doe_high_needs_pct: existing.doe_high_needs_pct ?? null,
        }
        upsertRows.push({
          school_district_geoid: d.school_district_geoid,
          school_district_name: d.school_district_name,
          county: d.county,
          year: targetYear,
          books_bfk: 0,
          books_bookmobile: 0,
          books_combined: 0,
          rolling_3yr_combined: rolling,
          ...computeRatios(rowForCalc, config),
        })
      }
    }

    // Upsert
    const { error: upsertError } = await adminSupabase
      .from('district_tiers')
      .upsert(upsertRows, { onConflict: 'school_district_geoid,year' })

    if (upsertError) throw upsertError

    const summary = {
      year: targetYear,
      districtsWithBooks: Object.keys(agg).length,
      districtsTotal: upsertRows.length,
      pointsMatched: matched.length,
      pointsUnmatched: unmatched.length,
      unmatchedPct: ((unmatched.length / filtered.length) * 100).toFixed(1),
    }

    await logRun('books_upload', req.user, 'success', summary)
    fs.unlinkSync(file.path)
    res.json(summary)

  } catch (err) {
    await logRun('books_upload', req.user, 'error', null, err.message)
    fs.unlinkSync(file.path)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/upload-doe ────────────────────────────────────────────
router.post('/upload-doe', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const wb = XLSX.readFile(file.path)
    const ws = wb.Sheets['Results']
    if (!ws) throw new Error("Sheet 'Results' not found — check EdSight export settings")

    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    // raw[0] = header labels, data starts at raw[1]
    const data = raw.slice(1).map(r => ({
      student_group:  r[0],
      district_raw:   r[1],
      school_year:    r[3],
      student_count:  r[4],
    }))

    // Parse year: '2024-25' → 2024
    const parseYear = sy => sy ? parseInt(sy.split('-')[0]) : null

    // Get our known district names
    const { data: knownDistricts } = await adminSupabase
      .from('district_tiers')
      .select('school_district_geoid, school_district_name')
    const nameToGeoid = Object.fromEntries(
      (knownDistricts || []).map(d => [d.school_district_name, d.school_district_geoid])
    )

    // Parse district name: strip trailing DoE ID
    const parseName = raw => raw?.replace(/\s*\(\d+\)\s*$/, '').trim()

    // Find new year
    const yearsInFile = [...new Set(data.map(r => parseYear(r.school_year)).filter(Boolean))]
    const { data: existingYears } = await adminSupabase
      .from('district_tiers').select('year')
    const existingYearSet = new Set((existingYears || []).map(r => r.year))
    const newYears = yearsInFile.filter(y => !existingYearSet.has(y))
    const targetYear = newYears.length ? Math.max(...newYears) : Math.max(...yearsInFile)

    const config = await getConfig()

    // Build totals and HN counts using min_count=1 logic (preserve null for suppressed)
    const byGeoidYear = {}
    for (const row of data) {
      const year = parseYear(row.school_year)
      if (year !== targetYear) continue
      const name  = parseName(row.district_raw)
      const geoid = nameToGeoid[name]
      if (!geoid) continue
      const count = row.student_count !== null ? Number(row.student_count) : null

      if (!byGeoidYear[geoid]) byGeoidYear[geoid] = { total: null, hn: null }

      if (row.student_group === null) {
        byGeoidYear[geoid].total = count
      } else if (row.student_group === 'High Needs') {
        byGeoidYear[geoid].hn = count
      }
    }

    // Upsert DoE columns + recompute ratios
    const upsertRows = []
    for (const [geoid, counts] of Object.entries(byGeoidYear)) {
      const hn_pct = counts.total && counts.hn !== null
        ? counts.hn / counts.total
        : null

      // Fetch current row for this geoid/year to get census + books data
      const { data: existing } = await adminSupabase
        .from('district_tiers')
        .select('rolling_3yr_combined, census_pop_0_4, census_pop_5_9, census_pop_0_9')
        .eq('school_district_geoid', geoid)
        .eq('year', targetYear)
        .single()

      const rowForCalc = {
        rolling_3yr_combined: existing?.rolling_3yr_combined ?? null,
        census_pop_0_4: existing?.census_pop_0_4 ?? null,
        census_pop_5_9: existing?.census_pop_5_9 ?? null,
        census_pop_0_9: existing?.census_pop_0_9 ?? null,
        doe_high_needs_pct: hn_pct,
      }

      const ratios = computeRatios(rowForCalc, config)

      upsertRows.push({
        school_district_geoid: geoid,
        year: targetYear,
        doe_total_enrollment: counts.total,
        doe_high_needs_count: counts.hn,
        doe_high_needs_pct: hn_pct,
        ...ratios,
      })
    }

    const { error: upsertError } = await adminSupabase
      .from('district_tiers')
      .upsert(upsertRows, { onConflict: 'school_district_geoid,year' })

    if (upsertError) throw upsertError

    const summary = {
      year: targetYear,
      districtsMatched: upsertRows.length,
      suppressed: upsertRows.filter(r => r.doe_high_needs_count === null && r.doe_total_enrollment !== null).length,
    }

    await logRun('doe_upload', req.user, 'success', summary)
    fs.unlinkSync(file.path)
    res.json(summary)

  } catch (err) {
    await logRun('doe_upload', req.user, 'error', null, err.message)
    fs.unlinkSync(file.path)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/census-refresh ────────────────────────────────────────
router.post('/census-refresh', async (req, res) => {
  try {
    const LATEST_ACS_VINTAGE = parseInt(process.env.LATEST_ACS_VINTAGE || '2024')

    // Find the year we need Census data for
    const { data: missingRows } = await adminSupabase
      .from('district_tiers')
      .select('year')
      .is('census_pop_0_9', null)
      .not('rolling_3yr_combined', 'is', null)
      .order('year', { ascending: false })
      .limit(1)

    const targetYear = missingRows?.[0]?.year
      ? Math.min(missingRows[0].year, LATEST_ACS_VINTAGE)
      : LATEST_ACS_VINTAGE

    const VARS = ['B01001_001E','B01001_003E','B01001_004E','B01001_027E','B01001_028E']
    const url = new URL(`https://api.census.gov/data/${targetYear}/acs/acs5`)
    url.searchParams.set('get', `NAME,${VARS.join(',')}`)
    url.searchParams.set('for', 'school district (unified):*')
    url.searchParams.set('in', 'state:09')
    url.searchParams.set('key', process.env.CENSUS_API_KEY)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Census API error ${response.status}: ${text}`)
    }

    const [header, ...rows] = await response.json()
    const config = await getConfig()

    const upsertRows = []
    for (const row of rows) {
      const rec   = Object.fromEntries(header.map((k, i) => [k, row[i]]))
      const geoid = rec.state.padStart(2,'0') + rec['school district (unified)'].padStart(5,'0')
      if (geoid === '0999997' || geoid === '0999998' || geoid === '0999999') continue

      const m04 = parseInt(rec.B01001_003E)
      const m59 = parseInt(rec.B01001_004E)
      const f04 = parseInt(rec.B01001_027E)
      const f59 = parseInt(rec.B01001_028E)

      const pop_0_4 = m04 + f04
      const pop_5_9 = m59 + f59
      const pop_0_9 = pop_0_4 + pop_5_9

      // Fetch existing row
      const { data: existing } = await adminSupabase
        .from('district_tiers')
        .select('rolling_3yr_combined, doe_high_needs_pct, doe_total_enrollment, doe_high_needs_count')
        .eq('school_district_geoid', geoid)
        .eq('year', targetYear)
        .single()

      const rowForCalc = {
        rolling_3yr_combined: existing?.rolling_3yr_combined ?? null,
        census_pop_0_4: pop_0_4,
        census_pop_5_9: pop_5_9,
        census_pop_0_9: pop_0_9,
        doe_high_needs_pct: existing?.doe_high_needs_pct ?? null,
      }

      const ratios = computeRatios(rowForCalc, config)

      upsertRows.push({
        school_district_geoid: geoid,
        year: targetYear,
        census_pop_0_4: pop_0_4,
        census_pop_5_9: pop_5_9,
        census_pop_0_9: pop_0_9,
        ...ratios,
      })
    }

    const { error: upsertError } = await adminSupabase
      .from('district_tiers')
      .upsert(upsertRows, { onConflict: 'school_district_geoid,year' })

    if (upsertError) throw upsertError

    const summary = { vintageYear: targetYear, districtsUpdated: upsertRows.length }
    await logRun('census_refresh', req.user, 'success', summary)
    res.json(summary)

  } catch (err) {
    await logRun('census_refresh', req.user, 'error', null, err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/config ─────────────────────────────────────────────────
router.get('/config', async (req, res) => {
  const { data, error } = await adminSupabase.from('pipeline_config').select('*').single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── PUT /api/admin/config ─────────────────────────────────────────────────
router.put('/config', async (req, res) => {
  const { coeff_0_9, coeff_0_4, coeff_5_9, ...thresholds } = req.body

  const validation = validateCoefficients(coeff_0_9, coeff_0_4, coeff_5_9)
  if (!validation.valid) return res.status(400).json({ error: validation.message })

  const newConfig = { coeff_0_9, coeff_0_4, coeff_5_9, ...thresholds, updated_by: req.user.email }
  const { error } = await adminSupabase.from('pipeline_config').update(newConfig).eq('id', 1)
  if (error) return res.status(500).json({ error: error.message })

  // Recalculate all ratios and tiers with new config
  const fullConfig = await getConfig()
  const { data: allRows } = await adminSupabase
    .from('district_tiers')
    .select('school_district_geoid, year, rolling_3yr_combined, census_pop_0_4, census_pop_5_9, census_pop_0_9, doe_high_needs_pct')

  const recalcRows = (allRows || []).map(row => ({
    school_district_geoid: row.school_district_geoid,
    year: row.year,
    ...computeRatios(row, fullConfig),
  }))

  // Upsert in batches
  for (let i = 0; i < recalcRows.length; i += 500) {
    await adminSupabase
      .from('district_tiers')
      .upsert(recalcRows.slice(i, i + 500), { onConflict: 'school_district_geoid,year' })
  }

  const summary = { rowsRecalculated: recalcRows.length, config: newConfig }
  await logRun('config_change', req.user, 'success', summary)
  res.json(summary)
})

// ── GET /api/admin/runs ───────────────────────────────────────────────────
router.get('/runs', async (req, res) => {
  const { data, error } = await adminSupabase
    .from('pipeline_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
