import { useState } from 'react'
import DistrictPicker from './DistrictPicker.jsx'
import TimelineBar from './TimelineBar.jsx'

export default function FilterBar({
  years, year, onYearChange,
  allCounties, selectedCounties, onCountiesChange,
  districts, selectedGeoid, onDistrictSelect,
  tierMode, onTierModeChange,
  isPlaying, onPlayPauseToggle,
  loading,
}) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <YearSelector years={years} value={year} onChange={onYearChange} />
        <CountyMultiSelect
          all={allCounties}
          selected={selectedCounties}
          onChange={onCountiesChange}
        />
        <DistrictPicker
          districts={districts}
          selectedGeoid={selectedGeoid}
          onSelect={onDistrictSelect}
        />
        <TimelineBar
          years={years}
          year={year}
          onYearChange={onYearChange}
          isPlaying={isPlaying}
          onPlayPauseToggle={onPlayPauseToggle}
        />
        <div className="ml-auto">
          <TierToggle value={tierMode} onChange={onTierModeChange} />
        </div>
        {loading && <span className="text-xs text-gray-500">Loading…</span>}
      </div>
    </div>
  )
}

function YearSelector({ years, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">Year</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      >
        {value == null && <option value="">—</option>}
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  )
}

function CountyMultiSelect({ all, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const summary =
    selected.length === 0 ? 'All counties'
    : selected.length === 1 ? selected[0]
    : `${selected.length} counties`

  function toggle(c) {
    onChange(
      selected.includes(c)
        ? selected.filter(x => x !== c)
        : [...selected, c]
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        {summary} <span className="ml-1 text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          {all.length === 0 && <div className="px-2 py-1 text-xs text-gray-500">No data loaded</div>}
          {all.map(c => (
            <label key={c} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={() => toggle(c)}
              />
              {c}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TierToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange('overall')}
        className={`rounded px-3 py-1 ${value === 'overall' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
      >
        Overall
      </button>
      <button
        type="button"
        onClick={() => onChange('hn')}
        className={`rounded px-3 py-1 ${value === 'hn' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
      >
        High-Needs
      </button>
    </div>
  )
}
