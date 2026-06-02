// Standalone Node harness that exercises the same fetch + shape logic as
// useOutcomeData(). Lets us spot-check the data without booting a browser.
// Usage: node frontend/scripts/verify-outcome-data.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  ELA_URL, KEI_URL, TYPOLOGY_URL, ELA_WHERE,
  fetchAllPages, fetchPage, shapeEla, shapeKei, shapeTypology,
} from '../src/hooks/outcomeData.core.js'

const here = dirname(fileURLToPath(import.meta.url))
const GEOJSON_PATH = join(here, '..', 'public', 'composite_simplified.geojson')

// Three districts spanning typology classes for a representative spot-check.
const SPOT_CHECKS = [
  { geoid: '0901920', name: 'Hartford',  expectedTypology: 'Urban Core' },
  { geoid: '0900120', name: 'Avon',      expectedTypology: 'Suburban' },
  { geoid: '0902040', name: 'Kent',      expectedTypology: 'Rural' },
]

function summarizeYearMap(yearMap) {
  if (!yearMap) return '(none)'
  const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b)
  if (!years.length) return '(empty)'
  return `${years.length} years (${years[0]}–${years[years.length - 1]})`
}

function showRow(year, row) {
  const fmt = v => v == null ? 'null' : String(v)
  return Object.entries(row).map(([k, v]) => `${k}=${fmt(v)}`).join(', ') + `  [year=${year}]`
}

async function main() {
  const geoJson = JSON.parse(await readFile(GEOJSON_PATH, 'utf8'))
  const districts = geoJson.features.map(f => f.properties)
  console.log(`GeoJSON districts loaded: ${districts.length}`)

  console.log('\nFetching ArcGIS layers in parallel...')
  const t0 = Date.now()
  const [elaRows, keiRows, typologyJson] = await Promise.all([
    fetchAllPages(ELA_URL, ELA_WHERE,
      'GEOID,Year_start,Student_Group,Category,ELAPerformanceIndex'),
    fetchAllPages(KEI_URL, '1=1',
      'GEOID,School_Year___Start,LI_PCT1,LI_PCT3'),
    fetchPage(TYPOLOGY_URL, {
      where: '1=1',
      outFields: 'TOWN,Group_',
      returnGeometry: 'false',
      f: 'json',
    }),
  ])
  const typologyRows = (typologyJson.features || []).map(f => f.attributes)
  console.log(`Fetched in ${Date.now() - t0}ms`)
  console.log(`  ELA rows:      ${elaRows.length}  (expected ~3002)`)
  console.log(`  KEI rows:      ${keiRows.length}  (expected ~1889)`)
  console.log(`  Typology rows: ${typologyRows.length}  (expected 169)`)

  const elaByGeoidYear = shapeEla(elaRows)
  const keiByGeoidYear = shapeKei(keiRows)
  const { typologyByGeoid, unresolved } = shapeTypology(typologyRows, districts)

  console.log(`\nShaped maps:`)
  console.log(`  ELA districts:      ${Object.keys(elaByGeoidYear).length}`)
  console.log(`  KEI districts:      ${Object.keys(keiByGeoidYear).length}`)
  console.log(`  Typology districts: ${Object.keys(typologyByGeoid).length} (of ${districts.length} GeoJSON districts)`)

  if (unresolved.length) {
    console.log(`\n⚠ Typology unresolved (${unresolved.length}):`)
    for (const u of unresolved) console.log(`    ${u.geoid}  ${u.name}  (tried town: ${u.town ?? '—'})`)
  }

  console.log('\n── Spot checks ────────────────────────────────────────────')
  let allOk = true
  for (const sc of SPOT_CHECKS) {
    console.log(`\n[${sc.geoid}] ${sc.name}`)
    const typ = typologyByGeoid[sc.geoid]
    const typOk = typ === sc.expectedTypology
    if (!typOk) allOk = false
    console.log(`  typology: ${typ ?? 'MISSING'}  (expected ${sc.expectedTypology})  ${typOk ? 'OK' : 'FAIL'}`)

    const elaYears = elaByGeoidYear[sc.geoid]
    console.log(`  ELA: ${summarizeYearMap(elaYears)}`)
    if (elaYears) {
      const years = Object.keys(elaYears).map(Number).sort((a, b) => b - a)
      for (const y of years.slice(0, 3)) console.log(`     ${showRow(y, elaYears[y])}`)
    }

    const keiYears = keiByGeoidYear[sc.geoid]
    console.log(`  KEI: ${summarizeYearMap(keiYears)}`)
    if (keiYears) {
      const years = Object.keys(keiYears).map(Number).sort((a, b) => b - a)
      for (const y of years.slice(0, 3)) console.log(`     ${showRow(y, keiYears[y])}`)
    }
  }

  // Regional district check — make sure each Regional School District in the
  // GeoJSON got a typology assignment via the override map.
  console.log('\n── Regional districts ─────────────────────────────────────')
  const regionals = districts
    .map(d => ({ geoid: d.GEOID, name: d.NAME }))
    .filter(d => d.name?.startsWith('Regional School District'))
  for (const r of regionals) {
    const t = typologyByGeoid[r.geoid] ?? 'MISSING'
    console.log(`  ${r.geoid}  ${r.name.padEnd(28)} → ${t}`)
  }

  console.log(`\n${allOk ? 'All spot checks OK.' : 'SOME SPOT CHECKS FAILED.'}`)
  process.exitCode = allOk ? 0 : 1
}

main().catch(err => {
  console.error('\nFATAL:', err)
  process.exit(2)
})
