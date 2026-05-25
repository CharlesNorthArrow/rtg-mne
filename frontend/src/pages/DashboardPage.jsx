import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/supabase.js'
import { useDashboardStore, NO_NEED_THRESHOLDS } from '../store/dashboard.js'
import { useDashboardUrlSync } from '../hooks/useDashboardUrlSync.js'
import {
  indexByYear,
  deriveYearRange,
  kpisFor,
  tierDistributionFor,
  progressionFor,
} from '../lib/dashboardSelectors.js'
import { countyShort } from '../lib/format.js'
import { assignTier, ratioFieldName, preComputedTierField } from '../lib/tiers.js'
import ControlStrip from '../components/dashboard/ControlStrip.jsx'
import MapView from '../components/dashboard/MapView.jsx'
import KpiStrip from '../components/dashboard/KpiStrip.jsx'
import TierDistribution from '../components/dashboard/TierDistribution.jsx'
import Progression from '../components/dashboard/Progression.jsx'
import DistrictPanel from '../components/dashboard/district/DistrictPanel.jsx'

export default function DashboardPage() {
  useDashboardUrlSync()

  // Store reads
  const year                   = useDashboardStore(s => s.selectedYear)
  const metric                 = useDashboardStore(s => s.selectedMetric)
  const age                    = useDashboardStore(s => s.selectedAge)
  const selectedCounties       = useDashboardStore(s => s.selectedCounties)
  const selectedGeoid          = useDashboardStore(s => s.selectedDistrictGeoid)
  const selectedNeedThresholds = useDashboardStore(s => s.selectedNeedThresholds)

  // Store writers
  const setYear              = useDashboardStore(s => s.setYear)
  const setMetric            = useDashboardStore(s => s.setMetric)
  const setAge               = useDashboardStore(s => s.setAge)
  const setCounties          = useDashboardStore(s => s.setCounties)
  const setSelected          = useDashboardStore(s => s.setSelectedDistrict)
  const setNeedThresholds    = useDashboardStore(s => s.setNeedThresholds)
  const resetNeedThresholds  = useDashboardStore(s => s.resetNeedThresholds)

  // Local state
  const [panel, setPanel]         = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    api.getPanel()
      .then(setPanel)
      .catch(err => setLoadError(err.message))
  }, [])

  // ── Derivations ──────────────────────────────────────────────────────
  const rowsByYear = useMemo(() => panel ? indexByYear(panel) : new Map(), [panel])
  const yearRange  = useMemo(() => panel ? deriveYearRange(panel) : { min: null, max: null }, [panel])

  // Tier / ratio accessors keyed off metric+age. When age = 0_9 we use the
  // pre-computed tier_overall / tier_hn columns; otherwise we compute the tier
  // client-side using the same thresholds the backend pipeline uses.
  const ratioField = ratioFieldName(metric, age)
  const tierField  = preComputedTierField(metric, age)  // may be null

  const ratioOf = useCallback((row) => row[ratioField], [ratioField])
  const tierOf  = useCallback(
    (row) => tierField ? row[tierField] : assignTier(row[ratioField], metric),
    [tierField, ratioField, metric]
  )

  // Default year to latest with tier data
  useEffect(() => {
    if (!panel) return
    const current = useDashboardStore.getState().selectedYear
    if (current == null && yearRange.max != null) setYear(yearRange.max)
    else if (yearRange.min != null && yearRange.max != null && current != null) {
      if (current < yearRange.min) setYear(yearRange.min)
      else if (current > yearRange.max) setYear(yearRange.max)
    }
  }, [panel, yearRange.min, yearRange.max, setYear])

  // 158-district list for the combobox (one row per district from the latest year)
  const districtsList = useMemo(() => {
    if (!panel) return []
    const latest = yearRange.max
    const seen = new Set()
    const rows = []
    for (let y = latest; y >= (yearRange.min ?? latest); y--) {
      for (const r of rowsByYear.get(y) || []) {
        if (!seen.has(r.school_district_geoid)) {
          seen.add(r.school_district_geoid)
          rows.push(r)
        }
      }
    }
    return rows.sort((a, b) => a.school_district_name.localeCompare(b.school_district_name))
  }, [panel, rowsByYear, yearRange])

  const counties = useMemo(() => {
    const set = new Set(districtsList.map(d => d.county).filter(Boolean))
    return [...set].sort()
  }, [districtsList])

  const filteredDistricts = useMemo(() => {
    if (!selectedCounties.length) return districtsList
    const s = new Set(selectedCounties)
    return districtsList.filter(d => s.has(d.county))
  }, [districtsList, selectedCounties])

  // Per-district series of (year, total, ed, el, swd) sorted ascending —
  // used by the Need filter to fall back to the most recent year with data
  // when the selected year hasn't been published yet for a given subgroup
  // (e.g. 2025-26 SwD counts aren't out from CSDE yet).
  const subgroupSeriesByGeoid = useMemo(() => {
    const map = new Map()
    for (const r of panel || []) {
      const key = r.school_district_geoid
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({
        year:  r.year,
        total: r.doe_total_enrollment,
        ed:    r.doe_econ_dis_count,
        el:    r.doe_english_learner_count,
        swd:   r.doe_swd_count,
      })
    }
    for (const arr of map.values()) arr.sort((a, b) => a.year - b.year)
    return map
  }, [panel])

  const visibleGeoids = useMemo(() => {
    const t = selectedNeedThresholds
    const needActive = t !== NO_NEED_THRESHOLDS &&
      (t.econDis > 0 || t.englishLearner > 0 || t.swd > 0)
    const countySet = selectedCounties.length ? new Set(selectedCounties) : null
    if (!countySet && !needActive) return 'all'

    // Latest share ≤ year for this geoid where (count + total) are both known.
    // Returns null if this subgroup has never been reported for the district.
    const latestShare = (arr, countKey) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const r = arr[i]
        if (r.year > year) continue
        if (r[countKey] != null && r.total != null && r.total > 0) return r[countKey] / r.total
      }
      return null
    }

    const out = new Set()
    for (const d of districtsList) {
      if (countySet && !countySet.has(d.county)) continue
      if (needActive) {
        const arr = subgroupSeriesByGeoid.get(d.school_district_geoid)
        if (!arr) continue
        const eShare = latestShare(arr, 'ed')
        const lShare = latestShare(arr, 'el')
        const sShare = latestShare(arr, 'swd')
        if (t.econDis        > 0 && (eShare == null || eShare < t.econDis        / 100)) continue
        if (t.englishLearner > 0 && (lShare == null || lShare < t.englishLearner / 100)) continue
        if (t.swd            > 0 && (sShare == null || sShare < t.swd            / 100)) continue
      }
      out.add(d.school_district_geoid)
    }
    return out
  }, [districtsList, selectedCounties, selectedNeedThresholds, subgroupSeriesByGeoid, year])

  useEffect(() => {
    if (!selectedGeoid) return
    if (visibleGeoids === 'all') return
    if (!visibleGeoids.has(selectedGeoid)) setSelected(null)
  }, [visibleGeoids, selectedGeoid, setSelected])

  // Escape clears the selected district (drop-back to snapshot mode)
  useEffect(() => {
    if (!selectedGeoid) return
    function onKey(e) { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedGeoid, setSelected])

  // H8 — proxy badge info for the currently-selected year. Render only if ANY
  // visible row in the selected year is using a carried-forward census vintage.
  const proxyInfo = useMemo(() => {
    if (year == null) return null
    const rows = rowsByYear.get(year) || []
    const filtered = visibleGeoids === 'all'
      ? rows
      : rows.filter(r => visibleGeoids.has(r.school_district_geoid))
    const proxied = filtered.find(r => r.census_is_proxy)
    if (!proxied) return null
    return { sourceYear: proxied.census_source_year }
  }, [rowsByYear, year, visibleGeoids])

  const kpis = useMemo(() => kpisFor({
    rowsByYear, year, visibleSet: visibleGeoids, tierOf, ratioOf,
  }), [rowsByYear, year, visibleGeoids, tierOf, ratioOf])

  const tierDist = useMemo(() => tierDistributionFor({
    rowsByYear, year, visibleSet: visibleGeoids, tierOf,
  }), [rowsByYear, year, visibleGeoids, tierOf])

  const progression = useMemo(() => {
    if (yearRange.min == null) return { years: [], series: {} }
    return progressionFor({
      rowsByYear,
      yMin: yearRange.min,
      yMax: yearRange.max,
      visibleSet: visibleGeoids,
      tierOf,
    })
  }, [rowsByYear, yearRange, visibleGeoids, tierOf])

  const progressionLabel = selectedCounties.length === 0
    ? 'statewide'
    : selectedCounties.length === 1
      ? countyShort(selectedCounties[0])
      : `${selectedCounties.length} counties`

  if (loadError) {
    return (
      <div className="m-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Couldn't load data: {loadError}. Check Supabase keys in <code>backend/.env</code> and that the backend is running.
      </div>
    )
  }

  if (!panel) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        Loading data…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3 overflow-hidden">
      <ControlStrip
        yearRange={yearRange}
        year={year}
        onYearChange={setYear}
        metric={metric}
        onMetricChange={setMetric}
        age={age}
        onAgeChange={setAge}
        counties={counties}
        selectedCounties={selectedCounties}
        onCountiesChange={setCounties}
        districts={filteredDistricts}
        selectedDistrictGeoid={selectedGeoid}
        onDistrictSelect={setSelected}
        isPlaying={isPlaying}
        onPlayPauseToggle={setIsPlaying}
        proxyInfo={proxyInfo}
        needThresholds={selectedNeedThresholds}
        onNeedChange={setNeedThresholds}
        onNeedReset={resetNeedThresholds}
        visibleCount={visibleGeoids === 'all' ? districtsList.length : visibleGeoids.size}
        totalCount={districtsList.length}
      />

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <MapView
            panelByYear={rowsByYear}
            year={year}
            tierMode={metric}
            tierOf={tierOf}
            ratioOf={ratioOf}
            visibleGeoids={visibleGeoids}
            selectedGeoid={selectedGeoid}
            onSelectDistrict={setSelected}
            countyFiltered={selectedCounties.length > 0}
          />
        </div>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
          {selectedGeoid ? (
            <DistrictPanel
              panel={panel}
              geoid={selectedGeoid}
              year={year}
              age={age}
              tierOf={tierOf}
              ratioOf={ratioOf}
              onClose={() => setSelected(null)}
            />
          ) : (
            <>
              <KpiStrip kpis={kpis} onPickDistrict={setSelected} />
              <TierDistribution year={year} dist={tierDist} />
              <div className="flex-1 min-h-0">
                <Progression progression={progression} year={year} label={progressionLabel} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
