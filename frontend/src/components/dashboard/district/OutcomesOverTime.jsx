import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useOutcomeData } from '../../../hooks/useOutcomeData.jsx'
import { makeVerticalYearLinePlugin } from '../../../lib/chartPlugins.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend)
ChartJS.register(makeVerticalYearLinePlugin('verticalYearLineOutcomes'))

// Colours per goal spec; KEI series are plain lines now (no area fill).
const COLOR_ELA_ALL  = '#243A78'
const COLOR_ELA_HN   = '#6B7280'
const COLOR_KEI_LOW  = '#EF4444'
const COLOR_KEI_HIGH = '#22C55E'

// Per goal: X-axis starts at 2014.
const FIRST_YEAR = 2014

function buildYears(elaYears, keiYears) {
  const s = new Set()
  for (const y of Object.keys(elaYears || {})) {
    const n = Number(y); if (Number.isFinite(n) && n >= FIRST_YEAR) s.add(n)
  }
  for (const y of Object.keys(keiYears || {})) {
    const n = Number(y); if (Number.isFinite(n) && n >= FIRST_YEAR) s.add(n)
  }
  return [...s].sort((a, b) => a - b)
}

export default function OutcomesOverTime({ geoid, year }) {
  const { keiByGeoidYear, elaByGeoidYear, loading } = useOutcomeData()
  const elaYears = elaByGeoidYear?.[geoid]
  const keiYears = keiByGeoidYear?.[geoid]

  const years = useMemo(() => buildYears(elaYears, keiYears), [elaYears, keiYears])

  const { elaAll, elaHn, keiLow, keiHigh } = useMemo(() => {
    const a = [], h = [], l = [], hi = []
    for (const y of years) {
      const e = elaYears?.[y]
      const k = keiYears?.[y]
      a.push (e?.ela_index_all ?? null)
      h.push (e?.ela_index_hn  ?? null)
      // KEI fractions (0–1) → 0–100 to match the right axis label.
      l.push (k?.li_pct1 != null ? +(k.li_pct1 * 100).toFixed(2) : null)
      hi.push(k?.li_pct3 != null ? +(k.li_pct3 * 100).toFixed(2) : null)
    }
    return { elaAll: a, elaHn: h, keiLow: l, keiHigh: hi }
  }, [years, elaYears, keiYears])

  const hasAny = [elaAll, elaHn, keiLow, keiHigh].some(arr => arr.some(v => v != null && !isNaN(v)))

  const data = useMemo(() => ({
    labels: years.map(String),
    datasets: [
      {
        label: 'ELA — All Students',
        data: elaAll,
        yAxisID: 'left',
        borderColor: COLOR_ELA_ALL,
        backgroundColor: COLOR_ELA_ALL,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'ELA — High Needs',
        data: elaHn,
        yAxisID: 'left',
        borderColor: COLOR_ELA_HN,
        backgroundColor: COLOR_ELA_HN,
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'KEI — Lowest %',
        data: keiLow,
        yAxisID: 'right',
        borderColor: COLOR_KEI_LOW,
        backgroundColor: COLOR_KEI_LOW,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'KEI — Highest %',
        data: keiHigh,
        yAxisID: 'right',
        borderColor: COLOR_KEI_HIGH,
        backgroundColor: COLOR_KEI_HIGH,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.25,
        spanGaps: true,
      },
    ],
  }), [years, elaAll, elaHn, keiLow, keiHigh])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#6B7280', font: { size: 9 }, maxRotation: 0, autoSkipPadding: 8 },
        grid: { display: false },
      },
      left: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'ELA Index', color: '#374151', font: { size: 9 } },
        ticks: { color: '#6B7280', font: { size: 9 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
        beginAtZero: false,
      },
      right: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'KEI %', color: '#374151', font: { size: 9 } },
        ticks: { color: '#6B7280', font: { size: 9 }, callback: v => `${v}%` },
        grid: { display: false },
        min: 0,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'center',
        labels: {
          boxWidth: 16,
          boxHeight: 2,
          font: { size: 10 },
          color: '#374151',
          padding: 8,
        },
      },
      tooltip: {
        callbacks: {
          title: items => `Year ${items[0].label}`,
          label: ctx => {
            if (ctx.parsed.y == null) return `${ctx.dataset.label}: —`
            const isKei = ctx.dataset.yAxisID === 'right'
            const v = isKei ? `${ctx.parsed.y.toFixed(1)}%` : ctx.parsed.y.toFixed(0)
            return `${ctx.dataset.label}: ${v}`
          },
        },
      },
      verticalYearLineOutcomes: { year },
    },
    animation: false,
  }), [year])

  return (
    <Wrapper title="Student outcomes over time">
      {loading ? (
        <Placeholder>Loading outcome data…</Placeholder>
      ) : !hasAny ? (
        <Placeholder>Student outcome data is not available for this district.</Placeholder>
      ) : (
        <div className="mt-1 flex-1 min-h-0" style={{ minHeight: 110 }}>
          <Line data={data} options={options} />
        </div>
      )}
    </Wrapper>
  )
}

// Wrapper matches the Mini card style used in DemographicsContext so the
// outcomes chart sits flush next to the HN-share chart.
function Wrapper({ title, children }) {
  return (
    <div
      className="flex flex-1 min-h-0 flex-col px-3 py-2"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Placeholder({ children }) {
  return (
    <div
      className="flex flex-1 items-center justify-center text-[11px]"
      style={{ color: 'var(--color-text-tertiary)', minHeight: 110 }}
    >
      {children}
    </div>
  )
}
