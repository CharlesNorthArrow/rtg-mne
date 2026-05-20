import { useEffect, useMemo, useRef, useState } from 'react'

export default function DistrictPicker({ districts, selectedGeoid, onSelect }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function onClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return districts
    const q = query.trim().toLowerCase()
    return districts.filter(d => d.school_district_name.toLowerCase().includes(q))
  }, [districts, query])

  const selected = districts.find(d => d.school_district_geoid === selectedGeoid)
  const label = selected
    ? selected.school_district_name
    : `All districts (${districts.length})`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-left hover:bg-gray-50 truncate"
      >
        {label} <span className="float-right text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search districts…"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
            )}
            {filtered.map(d => (
              <li
                key={d.school_district_geoid}
                onClick={() => { onSelect(d.school_district_geoid); setOpen(false); setQuery('') }}
                className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-100 ${
                  d.school_district_geoid === selectedGeoid ? 'bg-blue-50' : ''
                }`}
              >
                <div className="truncate">{d.school_district_name}</div>
                <div className="text-xs text-gray-500">{d.county}</div>
              </li>
            ))}
          </ul>
          {selectedGeoid && (
            <button
              onClick={() => { onSelect(null); setOpen(false); setQuery('') }}
              className="w-full border-t border-gray-100 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  )
}
