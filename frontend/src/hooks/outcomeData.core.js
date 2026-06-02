// Pure (no React, no JSX) helpers for the outcome-data hook. Split from
// useOutcomeData.jsx so a Node verification script can import it.

const ARCGIS_BASE = 'https://services5.arcgis.com/IJjAyk93TGaMwoTf/arcgis/rest/services'
export const ELA_URL      = `${ARCGIS_BASE}/Public%20Data%20ED%20SD%20Performance%20Joined/FeatureServer/0/query`
export const KEI_URL      = `${ARCGIS_BASE}/Public%20Data%20ED%20KEI%20Joined/FeatureServer/0/query`
export const TYPOLOGY_URL = `${ARCGIS_BASE}/Connecticut%20Town%20Typology%205CT%20RTG/FeatureServer/0/query`

// Verified via discovery: filtering ELA to district + high-needs aggregates
// drops 31,528 → 3,002 rows (still > 2,000 maxRecordCount, so pagination needed).
export const ELA_WHERE = "Student_Group='District' OR Student_Group='High Needs'"
export const PAGE_SIZE = 2000

// Regional School Districts → primary town for typology lookup.
// Verified against the 169-town typology layer. Where member towns span more
// than one typology class, the cross-class members are listed in the comment
// so the choice can be revisited.
export const REGIONAL_PRIMARY_TOWN = {
  'Regional School District 06': 'Goshen',      // + Morris, Warren (all Rural)
  'Regional School District 10': 'Burlington',  // Suburban; + Harwinton (Rural) ← MIXED
  'Regional School District 12': 'Washington',  // Rural; + Bridgewater, Roxbury (Suburban) ← MIXED
  'Regional School District 13': 'Durham',      // + Middlefield (both Suburban)
  'Regional School District 14': 'Woodbury',    // Suburban; + Bethlehem (Rural) ← MIXED
  'Regional School District 15': 'Southbury',   // + Middlebury (both Suburban)
  'Regional School District 16': 'Prospect',    // Suburban; + Beacon Falls (Rural) ← MIXED
  'Regional School District 17': 'Haddam',      // + Killingworth (both Suburban)
  'Regional School District 18': 'Old Lyme',    // + Lyme (both Suburban)
}

export function townFromDistrictName(name) {
  if (!name) return null
  if (name.startsWith('Regional School District')) return null
  return name.replace(/ School District$/, '').trim()
}

export async function fetchPage(baseUrl, paramsObj) {
  const params = new URLSearchParams(paramsObj)
  const res = await fetch(`${baseUrl}?${params}`)
  if (!res.ok) throw new Error(`ArcGIS ${res.status} ${res.statusText} (${baseUrl})`)
  const json = await res.json()
  if (json.error) throw new Error(`ArcGIS error: ${json.error.message || JSON.stringify(json.error)}`)
  return json
}

export async function fetchAllPages(baseUrl, where, outFields) {
  const out = []
  let offset = 0
  while (true) {
    const json = await fetchPage(baseUrl, {
      where,
      outFields,
      returnGeometry: 'false',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
      f: 'json',
    })
    const features = json.features || []
    for (const f of features) out.push(f.attributes)
    if (features.length < PAGE_SIZE || !json.exceededTransferLimit) break
    offset += features.length
  }
  return out
}

// SCHOOLYEAR is a publish-stamp constant across all rows in current ArcGIS data,
// so we ignore it and use the per-row Year_start (ELA) / School_Year___Start (KEI).
function toYear(v) {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseInt(String(v).slice(0, 4), 10)
  return Number.isFinite(n) ? n : null
}

export function shapeEla(rows) {
  const out = {}
  for (const r of rows) {
    const geoid = r.GEOID
    const year  = toYear(r.Year_start)
    if (!geoid || year == null) continue
    const slot = (out[geoid] ||= {})
    const row  = (slot[year]  ||= { ela_index_all: null, ela_index_hn: null })
    if (r.Student_Group === 'District')    row.ela_index_all = r.ELAPerformanceIndex ?? null
    if (r.Student_Group === 'High Needs')  row.ela_index_hn  = r.ELAPerformanceIndex ?? null
  }
  return out
}

export function shapeKei(rows) {
  const out = {}
  for (const r of rows) {
    const geoid = r.GEOID
    const year  = toYear(r.School_Year___Start)
    if (!geoid || year == null) continue
    const slot = (out[geoid] ||= {})
    slot[year] = {
      li_pct1: r.LI_PCT1 ?? null,
      li_pct3: r.LI_PCT3 ?? null,
    }
  }
  return out
}

export function shapeTypology(typologyRows, geoJsonDistricts) {
  const townToGroup = {}
  for (const r of typologyRows) townToGroup[r.TOWN] = r.Group_

  const out = {}
  const unresolved = []
  for (const d of geoJsonDistricts) {
    const geoid = d.GEOID || d.geoid
    const name  = d.NAME  || d.name
    if (!geoid || !name) continue

    let town = townFromDistrictName(name)
    if (town == null) town = REGIONAL_PRIMARY_TOWN[name] ?? null

    const group = town ? townToGroup[town] : null
    if (group) out[geoid] = group
    else unresolved.push({ geoid, name, town })
  }
  return { typologyByGeoid: out, unresolved }
}
