import { useMemo, useState } from 'react'
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
const COLOR_ECON    = '#B2182B'  // tier-0 red (HN's dominant subgroup)
const COLOR_EL      = '#EF8A62'  // tier-1 lighter red-orange
const COLOR_SWD     = '#6B7280'  // slate

// Lighter shades of EconDis red for the Free/Reduced split.
const COLOR_FREE    = '#B2182B'
const COLOR_REDUCED = '#EF8A62'

// Small categorical palette for the 7 SwD subtypes (Tableau 10-ish).
const COLOR_SWD_SUB = {
  autism:       '#1f77b4',
  emotional:    '#ff7f0e',
  intellectual: '#2ca02c',
  learning:     '#9467bd',
  other:        '#8c564b',
  otherHealth:  '#e377c2',
  speech:       '#17becf',
}

const SUBGROUP_LABEL = {
  econDis: 'Economically Disadvantaged',
  el:      'English Learners',
  swd:     'Students with Disabilities',
}

const SWD_LABEL = {
  autism: 'Autism', emotional: 'Emotional', intellectual: 'Intellectual',
  learning: 'Learning', other: 'Other', otherHealth: 'Other Health Imp.', speech: 'Speech/Language',
}

function lineDataset({ label, data, color, dashed = false }) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 1.5,
    borderDash: dashed ? [3, 3] : undefined,
    pointRadius: 0,
    tension: 0.2,
    spanGaps: true,
  }
}

export default function DemographicsContext({ demographics, age, year }) {
  const {
    years, hnPct, ratioOverall,
    ratioEconDis, ratioEL, ratioSwD,
    econDisSplit, swdSplit,
  } = demographics

  const [splitEconDis, setSplitEconDis] = useState(false)
  const [splitSwD, setSplitSwD]         = useState(false)

  const labels = useMemo(() => years.map(String), [years])
  const hasAnyHn = hnPct.some(v => v != null && !isNaN(v))

  // HN-share mini-chart (unchanged)
  const hnData = useMemo(() => ({
    labels,
    datasets: [lineDataset({ label: 'High-needs share', data: hnPct.map(v => v == null ? null : v * 100), color: COLOR_ECON })],
  }), [labels, hnPct])

  // Build the ratio chart datasets: Overall + 3 subgroups (or splits when toggled).
  const ratiosData = useMemo(() => {
    const ds = [lineDataset({ label: 'Overall', data: ratioOverall, color: COLOR_OVERALL })]

    if (splitEconDis) {
      ds.push(lineDataset({ label: 'Free meals',    data: econDisSplit.freeMeals,    color: COLOR_FREE }))
      ds.push(lineDataset({ label: 'Reduced price', data: econDisSplit.reducedPrice, color: COLOR_REDUCED, dashed: true }))
    } else {
      ds.push(lineDataset({ label: SUBGROUP_LABEL.econDis, data: ratioEconDis, color: COLOR_ECON }))
    }

    ds.push(lineDataset({ label: SUBGROUP_LABEL.el, data: ratioEL, color: COLOR_EL }))

    if (splitSwD) {
      for (const k of ['autism','emotional','intellectual','learning','other','otherHealth','speech']) {
        ds.push(lineDataset({ label: SWD_LABEL[k], data: swdSplit[k], color: COLOR_SWD_SUB[k] }))
      }
    } else {
      ds.push(lineDataset({ label: SUBGROUP_LABEL.swd, data: ratioSwD, color: COLOR_SWD }))
    }
    return { labels, datasets: ds }
  }, [labels, ratioOverall, ratioEconDis, ratioEL, ratioSwD, econDisSplit, swdSplit, splitEconDis, splitSwD])

  const hasAnyRatio = ratiosData.datasets.some(d => d.data.some(v => v != null && !isNaN(v)))

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
    <div className="flex flex-1 min-h-0 gap-3">
      <Mini title="High-needs share over time" empty={!hasAnyHn}>
        <Line data={hnData} options={hnOptions} />
      </Mini>
      <Mini
        title={`Books per child by group · ${AGE_LABELS[age]}`}
        empty={!hasAnyRatio}
        legend={
          <RatioLegend
            splitEconDis={splitEconDis}
            splitSwD={splitSwD}
            onToggleEconDis={() => setSplitEconDis(v => !v)}
            onToggleSwD={() => setSplitSwD(v => !v)}
          />
        }
      >
        <Line data={ratiosData} options={ratiosOptions} />
      </Mini>
    </div>
  )
}

function RatioLegend({ splitEconDis, splitSwD, onToggleEconDis, onToggleSwD }) {
  return (
    <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
      <Swatch color={COLOR_OVERALL} label="Overall" />
      <SplitPill
        color={COLOR_ECON}
        label="Econ Dis"
        active={splitEconDis}
        onClick={onToggleEconDis}
        title="Split into Free / Reduced-Price meals"
      />
      <Swatch color={COLOR_EL} label="EL" />
      <SplitPill
        color={COLOR_SWD}
        label="SwD"
        active={splitSwD}
        onClick={onToggleSwD}
        title="Split into 7 disability sub-types"
      />
    </div>
  )
}

function Swatch({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1">
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 0,
          borderTop: `${dashed ? '1.5px dashed' : '1.5px solid'} ${color}`,
        }}
      />
      {label}
    </span>
  )
}

function SplitPill({ color, label, active, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5"
      style={{
        background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
        color: 'var(--color-text-tertiary)',
        border: '0.5px solid transparent',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 0,
          borderTop: `1.5px solid ${color}`,
        }}
      />
      {label}
      <span style={{ fontSize: 8, marginLeft: 1 }}>{active ? '▾' : '▸'}</span>
    </button>
  )
}

function Mini({ title, empty, legend, children }) {
  return (
    <div
      className="flex flex-1 min-h-0 flex-col px-3 py-2"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{title}</div>
        {legend}
      </div>
      <div className="mt-1 flex-1 min-h-0" style={{ minHeight: 110 }}>
        {empty ? (
          <div className="flex h-full items-center justify-center text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No data
          </div>
        ) : children}
      </div>
    </div>
  )
}
