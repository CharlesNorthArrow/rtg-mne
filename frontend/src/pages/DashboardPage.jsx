import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/supabase.js'
import FilterBar from '../components/dashboard/FilterBar.jsx'
import MapView from '../components/dashboard/MapView.jsx'

export default function DashboardPage() {
  const [years, setYears]               = useState([])
  const [year, setYear]                 = useState(null)
  const [districts, setDistricts]       = useState([])
  const [selectedCounties, setCounties] = useState([])  // empty = all
  const [tierMode, setTierMode]         = useState('overall')  // 'overall' | 'hn'
  const [selectedGeoid, setSelected]    = useState(null)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [loadError, setLoadError]       = useState(null)

  // Load years once, pick the latest
  useEffect(() => {
    api.getYears()
      .then(ys => {
        setYears(ys)
        if (ys.length && year == null) setYear(ys[0])
      })
      .catch(err => setLoadError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload districts when year changes
  useEffect(() => {
    if (year == null) return
    setLoadError(null)
    api.getDistricts(year)
      .then(setDistricts)
      .catch(err => setLoadError(err.message))
  }, [year])

  const allCounties = useMemo(() => {
    const set = new Set(districts.map(d => d.county).filter(Boolean))
    return [...set].sort()
  }, [districts])

  // Districts filtered by county selection (drives the picker list AND the map)
  const filteredDistricts = useMemo(() => {
    if (!selectedCounties.length) return districts
    const s = new Set(selectedCounties)
    return districts.filter(d => s.has(d.county))
  }, [districts, selectedCounties])

  // When the county filter changes, drop a district selection that no longer fits
  useEffect(() => {
    if (!selectedGeoid) return
    if (!filteredDistricts.find(d => d.school_district_geoid === selectedGeoid)) {
      setSelected(null)
    }
  }, [filteredDistricts, selectedGeoid])

  return (
    <div className="flex h-full flex-col">
      <FilterBar
        years={years}
        year={year}
        onYearChange={setYear}
        allCounties={allCounties}
        selectedCounties={selectedCounties}
        onCountiesChange={setCounties}
        districts={filteredDistricts}
        selectedGeoid={selectedGeoid}
        onDistrictSelect={setSelected}
        tierMode={tierMode}
        onTierModeChange={setTierMode}
        isPlaying={isPlaying}
        onPlayPauseToggle={setIsPlaying}
        loading={year != null && districts.length === 0 && !loadError}
      />
      {loadError && (
        <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Couldn't load data: {loadError}. Check Supabase keys in <code>backend/.env</code> and that the dev server is running.
        </div>
      )}
      <div className="flex-1 min-h-0 p-4">
        <MapView
          districts={filteredDistricts}
          tierMode={tierMode}
          selectedGeoid={selectedGeoid}
          onSelectDistrict={setSelected}
          countyFiltered={selectedCounties.length > 0}
        />
      </div>
    </div>
  )
}
