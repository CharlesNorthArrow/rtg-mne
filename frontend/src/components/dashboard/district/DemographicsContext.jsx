import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { AGE_LABELS } from '../../../lib/tiers.js'
import { makeVerticalYearLinePlugin } from '../../../lib/chartPlugins.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip)
ChartJS.register(makeVerticalYearLinePlugin('verticalYearLineDemographics'))

const COLOR_OVERALL = '#243A78'  // brand blue
const COLOR_HN      = '#B2182B'  // tier-0 dark red (warm, contrasts with brand blue)

export default function DemographicsContext({ demographics, age, year }) {
  const { years, hnPct, ratioOverall, ratioHn } = demographics
  const labels = useMemo(() => years.map(String), [years])
  const hasAnyHn = hnPct.some(v => v != null && !isNaN(v))
  const hasAnyRatio = ratioOverall.some(v => v != null && !isNaN(v))
                  || ratioHn.some(v => v != null && !isNaN(v))

  const hnData = useMemo(() => ({
    labels,
    datasets: [{
      label: 'High-needs share',
      data: hnPct.map(v => v == null ? null : v * 100),  // pct as 0–100
      borderColor: COLOR_HN,
      backgroundColor: COLOR_HN,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.2,
      spanGaps: true,
    }],
  }), [labels, hnPct])

  const ratiosData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Overall',
        data: ratioOverall,
        borderColor: COLOR_OVERALL,
        backgroundColor: COLOR_OVERALL,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2,
        spanGaps: true,
      },
      {
        label: 'High-needs',
        data: ratioHn,
        borderColor: COLOR_HN,
        backgroundColor: COLOR_HN,
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0.2,
        spanGaps: true,
      },
    ],
  }), [labels, ratioOverall, ratioHn])

  const baseOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#6B7280', font: { size: 9 }, maxRotation: 0, autoSkipPadding: 8 },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#6B7280', font: { size: 9 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      verticalYearLineDemographics: { year },
    },
    animation: false,
  }), [year])

  const hnOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          title: items => `Year ${items[0].label}`,
          label: ctx => `HN share: ${ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(1) + '%'}`,
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        ticks: { ...baseOptions.scales.y.ticks, callback: v => `${v}%` },
      },
    },
  }), [baseOptions])

  const ratiosOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          title: items => `Year ${items[0].label}`,
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(3)}`,
        },
      },
    },
  }), [baseOptions])

  return (
    <div className="grid grid-cols-2 gap-3">
      <Mini title="High-needs share over time" empty={!hasAnyHn}>
        <Line data={hnData} options={hnOptions} />
      </Mini>
      <Mini
        title={`Overall vs HN ratio · ${AGE_LABELS[age]}`}
        empty={!hasAnyRatio}
        legend={
          <div className="flex items-center gap-3 text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <Swatch color={COLOR_OVERALL} label="Overall" />
            <Swatch color={COLOR_HN} label="High-needs" dashed />
          </div>
        }
      >
        <Line data={ratiosData} options={ratiosOptions} />
      </Mini>
    </div>
  )
}

function Mini({ title, empty, legend, children }) {
  return (
    <div
      className="flex flex-col px-3 py-2"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
        minHeight: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{title}</div>
        {legend}
      </div>
      <div className="mt-1 flex-1 min-h-0" style={{ height: 110 }}>
        {empty ? (
          <div className="flex h-full items-center justify-center text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No data
          </div>
        ) : children}
      </div>
    </div>
  )
}

function Swatch({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1">
      <span
        style={{
          display: 'inline-block',
          width: 14,
          height: 0,
          borderTop: `${dashed ? '1.5px dashed' : '1.5px solid'} ${color}`,
        }}
      />
      {label}
    </span>
  )
}
