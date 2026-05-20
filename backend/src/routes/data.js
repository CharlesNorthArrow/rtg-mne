import { Router } from 'express'
import { publicSupabase } from '../lib/supabase.js'

const router = Router()

// GET /api/data/years — list of available years in the dataset
router.get('/years', async (req, res) => {
  // Server-side DISTINCT via RPC — `.select('year').limit(N)` is capped by
  // PostgREST's project-level max-rows (default 1000), which truncated older years.
  const { data, error } = await publicSupabase.rpc('years_with_data')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/data/districts?year=&county= — all districts for a year (map + table)
router.get('/districts', async (req, res) => {
  const { year, county } = req.query
  if (!year) return res.status(400).json({ error: 'year is required' })

  let query = publicSupabase
    .from('district_tiers')
    .select(`
      school_district_geoid, school_district_name, sd_type, county, year,
      books_combined, rolling_3yr_combined,
      doe_high_needs_pct,
      census_pop_0_9,
      ratio_0_9, ratio_0_9_hn,
      tier_overall, tier_hn
    `)
    .eq('year', year)

  if (county) query = query.eq('county', county)

  const { data, error } = await query.order('school_district_name')
  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

// GET /api/data/district/:geoid — full longitudinal data for one district
router.get('/district/:geoid', async (req, res) => {
  const { geoid } = req.params

  const { data, error } = await publicSupabase
    .from('district_tiers')
    .select('*')
    .eq('school_district_geoid', geoid)
    .order('year', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  if (!data.length) return res.status(404).json({ error: 'District not found' })

  res.json(data)
})

// GET /api/data/summary/:year — aggregate stats for a year
router.get('/summary/:year', async (req, res) => {
  const { year } = req.params

  const { data: current, error } = await publicSupabase
    .from('district_tiers')
    .select('tier_overall, tier_hn, rolling_3yr_combined')
    .eq('year', parseInt(year))

  if (error) return res.status(500).json({ error: error.message })

  // Prior year for YoY tier movement
  const { data: prior } = await publicSupabase
    .from('district_tiers')
    .select('school_district_geoid, tier_overall, tier_hn')
    .eq('year', parseInt(year) - 1)

  const priorMap = Object.fromEntries((prior || []).map(r => [r.school_district_geoid, r]))

  // Tier distribution
  const tierCounts = { overall: {}, hn: {} }
  for (let t = 0; t <= 5; t++) {
    tierCounts.overall[t] = current.filter(r => r.tier_overall === t).length
    tierCounts.hn[t] = current.filter(r => r.tier_hn === t).length
  }

  // YoY movers
  const { data: currentFull } = await publicSupabase
    .from('district_tiers')
    .select('school_district_geoid, tier_overall, tier_hn')
    .eq('year', parseInt(year))

  let movedUp = 0, movedDown = 0
  for (const row of (currentFull || [])) {
    const p = priorMap[row.school_district_geoid]
    if (!p) continue
    if (row.tier_overall > p.tier_overall) movedUp++
    if (row.tier_overall < p.tier_overall) movedDown++
  }

  res.json({
    year: parseInt(year),
    totalDistricts: current.length,
    totalBooks: current.reduce((s, r) => s + (r.rolling_3yr_combined || 0), 0),
    tierCounts,
    movedUp,
    movedDown,
    withData: current.filter(r => r.tier_overall !== null).length,
  })
})

export default router
