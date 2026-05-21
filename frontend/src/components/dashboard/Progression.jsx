import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { TIER_CONFIG, TIER_KEYS } from '../../lib/tiers.js'
import { makeVerticalYearLinePlugin } from '../../lib/chartPlugins.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)
ChartJS.register(makeVerticalYearLinePlugin('verticalYearLine'))

export default function Progression({ progression, year, label }) {
  const { years, series } = progression

  // Order: T0 at the bottom of the stack → T5 → no-data at the top.
  const datasets = useMemo(() => {
    const make = (tier) => {
      const cfg = TIER_CONFIG[tier]
      const fill = cfg.mapColor === 'transparent' ? '#E5E7EB' : cfg.mapColor
      return {
        label: cfg.label,
        data: series[tier],
        backgroundColor: fill,
        borderColor: fill,
        borderWidth: 0.5,
        fill: true,
        pointRadius: 0,
        tension: 0,
      }
    }
    // Tiers T0..T5 stacked bottom→top, "no data" on top in a muted grey
    // (Chart.js can't render the stripe pattern from the legend; flat grey reads as "other").
    const out = TIER_KEYS.map(make)
    out.push({
      label: 'No data',
      data: series.null,
      backgroundColor: 'rgba(229, 231, 235, 0.7)',
      borderColor: '#9CA3AF',
      borderWidth: 0.5,
      fill: true,
      pointRadius: 0,
      tension: 0,
    })
    return out
  }, [series])

  const data = {
    labels: years.map(String),
    datasets,
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#6B7280', font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        stacked: true,
        ticks: { color: '#6B7280', font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Year ${items[0].label}`,
        },
      },
      verticalYearLine: { year },
    },
    elements: {
      line: { borderJoinStyle: 'round' },
    },
    animation: false,
  }

  return (
    <div
      className="flex flex-col p-4"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
        minHeight: 0,
      }}
    >
      <div className="mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Progression · {label} · {years[0]}–{years[years.length - 1]}
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
