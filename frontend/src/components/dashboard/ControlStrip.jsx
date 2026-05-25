import { useEffect, useMemo, useRef, useState } from 'react'
import { countyShort, SD_TYPE_LABEL } from '../../lib/format.js'
import { AGE_BRACKETS, AGE_LABELS } from '../../lib/tiers.js'
import CensusProxyBadge from './CensusProxyBadge.jsx'

const PLAY_STEP_MS = 800

export default function ControlStrip({
  yearRange,
  year,
  onYearChange,
  metric,
  onMetricChange,
  age,
  onAgeChange,
  counties,
  selectedCounties,
  onCountiesChange,
  districts,
  selectedDistrictGeoid,
  onDistrictSelect,
  isPlaying,
  onPlayPauseToggle,
  proxyInfo,
  needThresholds,
  onNeedChange,
  onNeedReset,
  visibleCount,
  totalCount,
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 px-4 py-2"
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-md, 8px)',
        minHeight: 56,
      }}
    >
      <CountyFilter
        all={counties}
        selected={selectedCounties}
        onChange={onCountiesChange}
      />
      <DistrictFilter
        districts={districts}
        selectedGeoid={selectedDistrictGeoid}
        onSelect={onDistrictSelect}
      />
      <MetricToggle value={metric} onChange={onMetricChange} />
      <AgeToggle value={age} onChange={onAgeChange} />
      <NeedFilter
        value={needThresholds}
        onChange={onNeedChange}
        onReset={onNeedReset}
        visibleCount={visibleCount}
        totalCount={totalCount}
      />
      <Playback
        yearRange={yearRange}
        year={year}
        onYearChange={onYearChange}
        isPlaying={isPlaying}
        onPlayPauseToggle={onPlayPauseToggle}
        proxyInfo={proxyInfo}
      />
    </div>
  )
}

// ── County multi-select ─────────────────────────────────────────────────
function CountyFilter({ all, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const label = selected.length === 0 ? 'All counties' : `Counties (${selected.length})`

  function toggle(c) {
    onChange(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c])
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="rounded px-3 py-1.5 text-sm"
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          color: 'var(--color-text-primary)',
          minWidth: 140,
          textAlign: 'left',
        }}
      >
        {label} <span className="ml-1" style={{ color: 'var(--color-text-tertiary)' }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 max-h-72 w-56 overflow-auto rounded-md p-2 shadow-lg"
          style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)' }}
        >
          {all.length === 0 && <div className="px-2 py-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No data</div>}
          {all.map(c => (
            <label key={c} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={() => toggle(c)}
              />
              <span>{countyShort(c)}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="mt-1 w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Need filter (3 lower-bound sliders) ────────────────────────────────
const NEED_KEYS = [
  { key: 'econDis',        label: 'Economically Disadvantaged' },
  { key: 'englishLearner', label: 'English Learners' },
  { key: 'swd',            label: 'Students with Disabilities' },
]

function NeedFilter({ value, onChange, onReset, visibleCount, totalCount }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const activeCount = NEED_KEYS.filter(k => (value?.[k.key] ?? 0) > 0).length
  const label = activeCount === 0 ? 'Need: any' : `Need (${activeCount})`

  function update(key, pct) {
    onChange({ ...value, [key]: pct })
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="rounded px-3 py-1.5 text-sm"
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          color: 'var(--color-text-primary)',
          minWidth: 130,
          textAlign: 'left',
        }}
        title="Filter districts by share of high-needs subgroups"
      >
        {label} <span className="ml-1" style={{ color: 'var(--color-text-tertiary)' }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-72 rounded-md p-3 shadow-lg"
          style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)' }}
        >
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Show districts where each share is at least…
          </div>
          {NEED_KEYS.map(({ key, label }) => (
            <div key={key} className="mb-2 last:mb-0">
              <div className="flex items-baseline justify-between text-xs mb-0.5">
                <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  ≥ {value?.[key] ?? 0}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={value?.[key] ?? 0}
                onChange={e => update(key, Number(e.target.value))}
                className="w-full accent-gray-700"
                aria-label={`Minimum ${label} %`}
              />
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--color-text-tertiary)' }}>
              Showing {visibleCount} of {totalCount}
            </span>
            {activeCount > 0 && (
              <button
                onClick={onReset}
                className="rounded px-2 py-0.5 hover:bg-gray-50"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── District combobox ──────────────────────────────────────────────────
function DistrictFilter({ districts, selectedGeoid, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selected = districts.find(d => d.school_district_geoid === selectedGeoid)

  const matches = useMemo(() => {
    if (!query.trim()) return districts
    const q = query.trim().toLowerCase()
    return districts.filter(d => d.school_district_name.toLowerCase().includes(q))
  }, [districts, query])

  return (
    <div className="relative shrink-0" ref={ref} style={{ flex: '0 1 240px', minWidth: 180 }}>
      <div
        className="flex items-center gap-1 rounded px-2 py-1"
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left text-sm truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {selected ? selected.school_district_name : <span style={{ color: 'var(--color-text-tertiary)' }}>All districts</span>}
        </button>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="px-1 text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Clear district"
            title="Clear district"
          >
            ×
          </button>
        )}
        <span style={{ color: 'var(--color-text-tertiary)' }}>▾</span>
      </div>
      {open && (
        <div
          className="absolute z-20 mt-1 w-72 rounded-md shadow-lg"
          style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)' }}
        >
          <div className="border-b p-2" style={{ borderColor: 'var(--color-border-tertiary)' }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search districts…"
              className="w-full rounded px-2 py-1 text-sm"
              style={{ border: '0.5px solid var(--color-border-tertiary)' }}
            />
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {matches.length === 0 && (
              <li className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No matches</li>
            )}
            {matches.map(d => {
              const isSel = d.school_district_geoid === selectedGeoid
              return (
                <li
                  key={d.school_district_geoid}
                  onClick={() => { onSelect(d.school_district_geoid); setOpen(false); setQuery('') }}
                  className="cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-50"
                  style={{ background: isSel ? 'var(--color-background-secondary)' : undefined }}
                >
                  <div className="truncate" style={{ color: 'var(--color-text-primary)' }}>{d.school_district_name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {SD_TYPE_LABEL[d.sd_type] || d.sd_type} · {countyShort(d.county)}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Metric toggle (Overall / High-Needs) ────────────────────────────────
function MetricToggle({ value, onChange }) {
  return (
    <Segmented
      options={[
        { value: 'overall', label: 'Overall',    title: 'Books distributed per child aged 0–9.' },
        { value: 'hn',      label: 'High-Needs', title: 'Books distributed per high-needs child.' },
      ]}
      value={value}
      onChange={onChange}
    />
  )
}

// ── Age toggle ──────────────────────────────────────────────────────────
function AgeToggle({ value, onChange }) {
  return (
    <Segmented
      options={AGE_BRACKETS.map(a => ({
        value: a,
        label: AGE_LABELS[a],
        title: `Ages ${AGE_LABELS[a]} only`,
      }))}
      value={value}
      onChange={onChange}
    />
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div
      className="inline-flex p-0.5 text-sm shrink-0"
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--radius-md, 8px)',
      }}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.title}
          className="rounded px-2.5 py-1 text-sm"
          style={{
            background: value === opt.value ? 'var(--color-background-secondary)' : 'transparent',
            fontWeight: value === opt.value ? 500 : 400,
            color: 'var(--color-text-primary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Playback (▶ + year slider) ─────────────────────────────────────────
function Playback({ yearRange, year, onYearChange, isPlaying, onPlayPauseToggle, proxyInfo }) {
  const { min, max } = yearRange
  const yearRef = useRef(year)
  yearRef.current = year

  useEffect(() => {
    if (!isPlaying || min == null || max == null) return
    const id = setInterval(() => {
      const cur = yearRef.current ?? min
      if (cur >= max) { onPlayPauseToggle(false); return }
      onYearChange(cur + 1)
    }, PLAY_STEP_MS)
    return () => clearInterval(id)
  }, [isPlaying, min, max, onYearChange, onPlayPauseToggle])

  function handlePlay() {
    if (year === max) onYearChange(min)
    onPlayPauseToggle(!isPlaying)
  }

  if (min == null || max == null) return null

  return (
    <div className="flex items-center gap-2 ml-auto" style={{ flex: '1 1 220px', minWidth: 220 }}>
      <button
        type="button"
        onClick={handlePlay}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white text-[11px] shrink-0"
        style={{ background: 'var(--color-brand-blue, #243A78)' }}
        title={isPlaying ? 'Pause' : 'Play year-by-year'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={year ?? min}
        onChange={e => onYearChange(Number(e.target.value))}
        className="flex-1 accent-gray-700"
        aria-label="Year"
      />
      <span
        className="tabular-nums font-medium shrink-0"
        style={{ fontSize: 14, color: 'var(--color-text-primary)', minWidth: 38, textAlign: 'right' }}
      >
        {year ?? '—'}
      </span>
      {proxyInfo && <CensusProxyBadge sourceYear={proxyInfo.sourceYear} />}
    </div>
  )
}
