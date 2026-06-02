import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { api } from '../lib/supabase.js'
import { useOutcomeData } from '../hooks/useOutcomeData.jsx'
import { TYPOLOGY_OPTIONS } from '../store/dashboard.js'
import { CountyFilter, TypologyFilter } from '../components/dashboard/ControlStrip.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip)

// ── Group definitions ───────────────────────────────────────────────────
// Per goal: classify each district by its tier_overall across the 5 most
// recent years that have any tier data. A district enters a group if it
// hit the relevant tier band in ≥ 4 of those 5 years.
const GROUPS = [
  { key: 'A', label: 'High Reach',     tiers: new Set([4, 5]) },
  { key: 'B', label: 'Moderate Reach', tiers: new Set([2, 3]) },
  { key: 'C', label: 'Low Reach',      tiers: new Set([0, 1]) },
]
const MIN_HITS = 4

// ── Metric column specs ─────────────────────────────────────────────────
// `higherIsBetter` drives the delta colour. The data source tells us where
// to look the value up: 'panel' = current-year panel row, 'kei' = KEI map,
// 'ela' = ELA map.
const METRICS = [
  { key: 'hnPct',     group: 'NEED',     label: 'High Needs %',           unit: 'pct',  source: 'panel', field: 'doe_high_needs_pct', higherIsBetter: false },
  { key: 'keiLow',    group: 'OUTCOMES', label: 'KEI Lowest %',           unit: 'pct',  source: 'kei',   field: 'li_pct1',            higherIsBetter: false },
  { key: 'keiHigh',   group: 'OUTCOMES', label: 'KEI Highest %',          unit: 'pct',  source: 'kei',   field: 'li_pct3',            higherIsBetter: true  },
  { key: 'elaAll',    group: 'OUTCOMES', label: 'ELA Index — All',        unit: 'num',  source: 'ela',   field: 'ela_index_all',      higherIsBetter: true  },
  { key: 'elaHn',     group: 'OUTCOMES', label: 'ELA Index — High Needs', unit: 'num',  source: 'ela',   field: 'ela_index_hn',       higherIsBetter: true  },
]
const DATA_THRESHOLD = 0.80   // ≥ 80% of districts must have data

const COLOR_GOOD = '#16A34A'
const COLOR_BAD  = '#DC2626'
const COLOR_NEUTRAL = 'var(--color-text-tertiary)'

// Faint group-tinted backgrounds. Kept low-saturation so the bold values
// and delta colours still read as the dominant ink.
const GROUP_ROW_BG = {
  A: 'rgba(36, 58, 120, 0.06)',   // brand blue tint — High Reach
  B: 'rgba(245, 158, 11, 0.08)',  // amber tint     — Moderate Reach
  C: 'rgba(220, 38, 38, 0.06)',   // red tint       — Low Reach
}

// Trend-row line colours for the 4 series. CT Average is rendered as a thin
// dashed neutral grey so it reads as the reference, not as a fourth group.
const TREND_SERIES = [
  { key: 'A',  label: 'High Reach',     color: '#243A78', dashed: false, width: 1.75 },
  { key: 'B',  label: 'Moderate Reach', color: '#F59E0B', dashed: false, width: 1.75 },
  { key: 'C',  label: 'Low Reach',      color: '#DC2626', dashed: false, width: 1.75 },
  { key: 'CT', label: 'CT Average',     color: '#374151', dashed: true,  width: 1.25 },
]

// ── Helpers ─────────────────────────────────────────────────────────────

// Resolve a metric's value for one geoid at one year. KEI is stored 0–1 so
// we multiply by 100 here to align with the % display.
function readMetric(metric, geoid, year, ctx) {
  if (metric.source === 'panel') {
    const row = ctx.panelByGeoidYear.get(`${geoid}:${year}`)
    const v = row?.[metric.field]
    return v == null ? null : Number(v)
  }
  if (metric.source === 'kei') {
    const v = ctx.keiByGeoidYear?.[geoid]?.[year]?.[metric.field]
    return v == null ? null : Number(v) * 100
  }
  if (metric.source === 'ela') {
    const v = ctx.elaByGeoidYear?.[geoid]?.[year]?.[metric.field]
    return v == null ? null : Number(v)
  }
  return null
}

// For a given metric and the filtered district set, find the most recent
// year where ≥ DATA_THRESHOLD of districts have a value. Returns null when
// no year clears the bar.
function pickReferenceYear(metric, geoids, ctx) {
  const totalDistricts = geoids.length
  if (totalDistricts === 0) return null

  // Collect candidate years from the relevant data source.
  const years = new Set()
  if (metric.source === 'panel') {
    for (const g of geoids) {
      const list = ctx.panelYearsByGeoid.get(g)
      if (list) for (const y of list) years.add(y)
    }
  } else if (metric.source === 'kei') {
    for (const g of geoids) {
      const yrs = ctx.keiByGeoidYear?.[g]
      if (yrs) for (const y of Object.keys(yrs)) years.add(Number(y))
    }
  } else if (metric.source === 'ela') {
    for (const g of geoids) {
      const yrs = ctx.elaByGeoidYear?.[g]
      if (yrs) for (const y of Object.keys(yrs)) years.add(Number(y))
    }
  }
  const sorted = [...years].sort((a, b) => b - a)
  for (const y of sorted) {
    let withData = 0
    for (const g of geoids) {
      if (readMetric(metric, g, y, ctx) != null) withData++
    }
    if (withData / totalDistricts >= DATA_THRESHOLD) return y
  }
  return null
}

function mean(values) {
  const clean = values.filter(v => v != null && !isNaN(v))
  if (clean.length === 0) return null
  return clean.reduce((s, v) => s + v, 0) / clean.length
}

function fmtValue(v, unit) {
  if (v == null) return '—'
  if (unit === 'pct') return `${v.toFixed(1)}%`
  return v.toFixed(1)
}

function fmtDelta(v, unit) {
  if (v == null) return ''
  const abs = Math.abs(v)
  const body = unit === 'pct' ? `${abs.toFixed(1)} pts` : abs.toFixed(1)
  return body
}

function deltaSign(val, ctVal, higherIsBetter) {
  if (val == null || ctVal == null) return { dir: 'none', color: COLOR_NEUTRAL, arrow: '' }
  const d = val - ctVal
  if (Math.abs(d) < 0.05) return { dir: 'flat', color: COLOR_NEUTRAL, arrow: '·' }
  const above = d > 0
  const good = higherIsBetter ? above : !above
  return {
    dir: above ? 'up' : 'down',
    color: good ? COLOR_GOOD : COLOR_BAD,
    arrow: above ? '↑' : '↓',
    raw: d,
  }
}

// ── Page ────────────────────────────────────────────────────────────────

export default function OutcomesPage() {
  const [panel, setPanel] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [selectedCounties, setSelectedCounties] = useState([])
  const [selectedTypologies, setSelectedTypologies] = useState([])

  const { typologyByGeoid, keiByGeoidYear, elaByGeoidYear, loading: outcomeLoading } = useOutcomeData()

  useEffect(() => {
    api.getPanel()
      .then(setPanel)
      .catch(err => setLoadError(err.message))
  }, [])

  // ── Indexing ──────────────────────────────────────────────────────────
  const panelByGeoidYear = useMemo(() => {
    const m = new Map()
    if (!panel) return m
    for (const r of panel) m.set(`${r.school_district_geoid}:${r.year}`, r)
    return m
  }, [panel])

  const panelYearsByGeoid = useMemo(() => {
    const m = new Map()
    if (!panel) return m
    for (const r of panel) {
      if (!m.has(r.school_district_geoid)) m.set(r.school_district_geoid, [])
      m.get(r.school_district_geoid).push(r.year)
    }
    return m
  }, [panel])

  // One representative row per district (most recent) for filter join + display
  const districts = useMemo(() => {
    if (!panel) return []
    const byGeoid = new Map()
    for (const r of panel) {
      const prev = byGeoid.get(r.school_district_geoid)
      if (!prev || r.year > prev.year) byGeoid.set(r.school_district_geoid, r)
    }
    return [...byGeoid.values()].map(r => ({
      geoid: r.school_district_geoid,
      name:  r.school_district_name,
      county: r.county,
      sdType: r.sd_type,
      typology: typologyByGeoid?.[r.school_district_geoid] ?? null,
    }))
  }, [panel, typologyByGeoid])

  const counties = useMemo(
    () => [...new Set(districts.map(d => d.county).filter(Boolean))].sort(),
    [districts],
  )

  // ── Filter ────────────────────────────────────────────────────────────
  const filteredGeoids = useMemo(() => {
    const countySet  = selectedCounties.length   ? new Set(selectedCounties)   : null
    const typoSet    = selectedTypologies.length ? new Set(selectedTypologies) : null
    return districts
      .filter(d => {
        if (countySet && !countySet.has(d.county)) return false
        if (typoSet) {
          // Districts with no typology resolution remain visible (consistent with dashboard rule)
          if (d.typology != null && !typoSet.has(d.typology)) return false
        }
        return true
      })
      .map(d => d.geoid)
  }, [districts, selectedCounties, selectedTypologies])

  // ── Tier-group classification ─────────────────────────────────────────
  const { classification, last5Years } = useMemo(() => {
    if (!panel || filteredGeoids.length === 0) return { classification: new Map(), last5Years: [] }
    const filteredSet = new Set(filteredGeoids)

    // 5 most recent calendar years where at least one filtered district has tier_overall
    const yearsWithTier = new Set()
    for (const r of panel) {
      if (r.tier_overall == null) continue
      if (!filteredSet.has(r.school_district_geoid)) continue
      yearsWithTier.add(r.year)
    }
    const last5 = [...yearsWithTier].sort((a, b) => b - a).slice(0, 5)
    const last5Set = new Set(last5)

    const cls = new Map()
    for (const geoid of filteredGeoids) {
      const counts = { A: 0, B: 0, C: 0 }
      for (const r of panel) {
        if (r.school_district_geoid !== geoid) continue
        if (!last5Set.has(r.year)) continue
        if (r.tier_overall == null) continue
        for (const g of GROUPS) if (g.tiers.has(r.tier_overall)) counts[g.key]++
      }
      let assigned = null
      for (const g of GROUPS) if (counts[g.key] >= MIN_HITS) { assigned = g.key; break }
      cls.set(geoid, assigned)
    }
    return { classification: cls, last5Years: last5 }
  }, [panel, filteredGeoids])

  // ── Reference year per metric ─────────────────────────────────────────
  const referenceYears = useMemo(() => {
    const ctx = { panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear }
    const out = {}
    for (const m of METRICS) out[m.key] = pickReferenceYear(m, filteredGeoids, ctx)
    return out
  }, [filteredGeoids, panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear])

  // ── Aggregate per group + CT average ──────────────────────────────────
  const rows = useMemo(() => {
    const ctx = { panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear }

    const valuesForGroup = (geoids) => {
      const out = {}
      for (const m of METRICS) {
        const year = referenceYears[m.key]
        if (year == null) { out[m.key] = null; continue }
        const vals = geoids.map(g => readMetric(m, g, year, ctx))
        out[m.key] = mean(vals)
      }
      return out
    }

    const ctRow = {
      key: 'ct',
      kind: 'ct',
      label: 'Connecticut Average',
      n: filteredGeoids.length,
      values: valuesForGroup(filteredGeoids),
    }

    const groupRows = GROUPS.map(g => {
      const members = filteredGeoids.filter(geoid => classification.get(geoid) === g.key)
      return {
        key: g.key,
        kind: 'group',
        label: g.label,
        n: members.length,
        values: valuesForGroup(members),
      }
    })

    const unclassifiedCount = filteredGeoids.filter(g => classification.get(g) == null).length

    return { groupRows, ctRow, unclassifiedCount }
  }, [filteredGeoids, classification, referenceYears, panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear])

  // ── Per-metric trend (one mini chart per column) ─────────────────────
  // For each metric, walk all years where any filtered district has a value
  // and compute the mean for each of {A, B, C, CT}. Years with no group
  // value emit null so chart.js spans the gap.
  const timelinesByMetric = useMemo(() => {
    const ctx = { panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear }
    const groupMembers = {
      A:  filteredGeoids.filter(g => classification.get(g) === 'A'),
      B:  filteredGeoids.filter(g => classification.get(g) === 'B'),
      C:  filteredGeoids.filter(g => classification.get(g) === 'C'),
      CT: filteredGeoids,
    }

    const out = {}
    for (const m of METRICS) {
      const yearSet = new Set()
      if (m.source === 'panel') {
        for (const g of filteredGeoids) {
          const yrs = panelYearsByGeoid.get(g)
          if (yrs) for (const y of yrs) yearSet.add(y)
        }
      } else if (m.source === 'kei') {
        for (const g of filteredGeoids) {
          const yrs = keiByGeoidYear?.[g]
          if (yrs) for (const y of Object.keys(yrs)) yearSet.add(Number(y))
        }
      } else if (m.source === 'ela') {
        for (const g of filteredGeoids) {
          const yrs = elaByGeoidYear?.[g]
          if (yrs) for (const y of Object.keys(yrs)) yearSet.add(Number(y))
        }
      }
      const years = [...yearSet].sort((a, b) => a - b)
      const series = { A: [], B: [], C: [], CT: [] }
      for (const y of years) {
        for (const key of ['A', 'B', 'C', 'CT']) {
          const vals = groupMembers[key].map(g => readMetric(m, g, y, ctx))
          series[key].push(mean(vals))
        }
      }
      out[m.key] = { years, series }
    }
    return out
  }, [filteredGeoids, classification, panelByGeoidYear, panelYearsByGeoid, keiByGeoidYear, elaByGeoidYear])

  // ── Render ─────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="m-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Couldn't load data: {loadError}.
      </div>
    )
  }
  if (!panel || outcomeLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
    <div className="flex h-full flex-col gap-4 p-[50px]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Outcomes Scorecard
          </h1>
          <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            Compare need and student outcomes across districts grouped by sustained reach tier
            {last5Years.length > 0 && ` · Reach classification uses ${last5Years[last5Years.length - 1]}–${last5Years[0]}`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CountyFilter   all={counties}         selected={selectedCounties}   onChange={setSelectedCounties} />
          <TypologyFilter all={TYPOLOGY_OPTIONS} selected={selectedTypologies} onChange={setSelectedTypologies} />
        </div>
      </header>

      <ColumnHeader referenceYears={referenceYears} />

      <div className="flex flex-col gap-1.5">
        {rows.groupRows.map(row => (
          <Row key={row.key} row={row} ct={rows.ctRow} bg={GROUP_ROW_BG[row.key]} />
        ))}
        <Row row={rows.ctRow} ct={null} bg="var(--color-background-secondary)" emphasised />
      </div>

      <TrendRow timelinesByMetric={timelinesByMetric} />

      <footer className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        <p>
          Showing {filteredGeoids.length} districts
          {rows.unclassifiedCount > 0 && ` · ${rows.unclassifiedCount} unclassified (didn't hit a single tier band in ≥${MIN_HITS} of the last ${last5Years.length || 5} years)`}.
          {' '}Reference year per metric is the most recent year where ≥{Math.round(DATA_THRESHOLD * 100)}% of the filtered districts have data.
        </p>
      </footer>
    </div>
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────

function ColumnHeader({ referenceYears }) {
  return (
    <div className="grid items-end px-3 pb-1" style={gridTemplate()}>
      <div /> {/* row-header spacer */}
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
        Need
      </div>
      <div className="text-[10px] uppercase tracking-wide col-span-4" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
        Outcomes
      </div>

      <div /> {/* row-header spacer for the metric label row */}
      {METRICS.map(m => (
        <div key={m.key} className="px-1 text-center">
          <div className="text-[11px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.label}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {referenceYears[m.key] != null ? `Ref year ${referenceYears[m.key]}` : 'No reference year'}
          </div>
        </div>
      ))}
    </div>
  )
}

function Row({ row, ct, bg, emphasised = false }) {
  return (
    <div
      className="grid items-center rounded-md px-3 py-2"
      style={{
        ...gridTemplate(),
        background: bg,
        border: emphasised ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent',
      }}
    >
      <RowLabel label={row.label} n={row.n} emphasised={emphasised} />
      {METRICS.map(m => (
        <Cell
          key={m.key}
          value={row.values[m.key]}
          ctValue={ct?.values?.[m.key] ?? null}
          metric={m}
          isCtRow={!ct}
        />
      ))}
    </div>
  )
}

function RowLabel({ label, n, emphasised }) {
  return (
    <div className="pr-2">
      <div className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: emphasised ? 600 : 500 }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        n={n}
      </div>
    </div>
  )
}

function Cell({ value, ctValue, metric, isCtRow }) {
  const delta = isCtRow ? null : deltaSign(value, ctValue, metric.higherIsBetter)
  return (
    <div className="px-1 leading-tight text-center">
      <div className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
        {fmtValue(value, metric.unit)}
      </div>
      {!isCtRow && delta && (
        <div className="text-[11px] tabular-nums" style={{ color: delta.color }}>
          {delta.arrow} {fmtDelta(delta.raw, metric.unit)}
        </div>
      )}
      {isCtRow && (
        <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          reference
        </div>
      )}
    </div>
  )
}

// 1 column for the row label + 1 per metric. The fr units give the metric
// cells equal width and keep the label tight on the left.
function gridTemplate() {
  return {
    gridTemplateColumns: `minmax(140px, 200px) repeat(${METRICS.length}, minmax(120px, 1fr))`,
    columnGap: '8px',
  }
}

// ── Trend row (one mini chart per metric column) ────────────────────────

function TrendRow({ timelinesByMetric }) {
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <TrendLegend />
      <div
        className="grid items-stretch rounded-md px-3 py-3"
        style={{ ...gridTemplate(), background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div className="pr-2">
          <div className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Trend
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            group means per year
          </div>
        </div>
        {METRICS.map(m => (
          <div key={m.key} className="px-1" style={{ height: 192 }}>
            <MetricSparkline metric={m} timeline={timelinesByMetric[m.key]} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
      {TREND_SERIES.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1">
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 18,
              height: 0,
              borderTop: `${s.width}px ${s.dashed ? 'dashed' : 'solid'} ${s.color}`,
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  )
}

function MetricSparkline({ metric, timeline }) {
  const data = useMemo(() => ({
    labels: timeline.years.map(String),
    datasets: TREND_SERIES.map(s => ({
      label: s.label,
      data: timeline.series[s.key],
      borderColor: s.color,
      backgroundColor: s.color,
      borderWidth: s.width,
      borderDash: s.dashed ? [4, 3] : undefined,
      pointRadius: 0,
      pointHoverRadius: 2.5,
      fill: false,
      tension: 0.25,
      spanGaps: true,
    })),
  }), [timeline])

  const hasAny = timeline.series.CT.some(v => v != null && !isNaN(v))

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
    scales: {
      x: {
        ticks: { color: '#9CA3AF', font: { size: 8 }, maxRotation: 0, autoSkipPadding: 6 },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: { color: '#9CA3AF', font: { size: 8 }, callback: v => metric.unit === 'pct' ? `${v}%` : v },
        grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
        border: { display: false },
        beginAtZero: false,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => `Year ${items[0].label}`,
          label: ctx => {
            if (ctx.parsed.y == null) return `${ctx.dataset.label}: —`
            const v = metric.unit === 'pct' ? `${ctx.parsed.y.toFixed(1)}%` : ctx.parsed.y.toFixed(1)
            return `${ctx.dataset.label}: ${v}`
          },
        },
      },
    },
    animation: false,
  }), [metric.unit])

  if (!hasAny) {
    return (
      <div className="flex h-full items-center justify-center text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        No data
      </div>
    )
  }
  return <Line data={data} options={options} />
}
