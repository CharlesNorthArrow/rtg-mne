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
const COLOR_HN      = '#B2182B'  // tier-0 red
const COLOR_ECON    = '#B2182B'  // EconDis is the dominant HN subgroup, uses the same red
const COLOR_EL      = '#EF8A62'  // tier-1 lighter red-orange
const COLOR_SWD     = '#6B7280'  // slate

// Lighter shades for Free vs Reduced Price split
const COLOR_FREE    = '#B2182B'
const COLOR_REDUCED = '#EF8A62'

// Small categorical palette for the 7 SwD subtypes
const COLOR_SWD_SUB = {
  autism:       '#1f77b4',
  emotional:    '#ff7f0e',
  intellectual: '#2ca02c',
  learning:     '#9467bd',
  other:        '#8c564b',
  otherHealth:  '#e377c2',
  speech:       '#17becf',
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
    years, ratioOverall, ratioHn,
    econDisShare, elShare, swdShare,
    econDisSplitShare, swdSplitShare,
  } = demographics

  const [splitEconDis, setSplitEconDis] = useState(false)
  const [splitSwD, setSplitSwD]         = useState(false)

  const labels = useMemo(() => years.map(String), [years])

  // ── Left: subgroup share over time (default 3 lines + 2 toggles) ────
  const shareData = useMemo(() => {
    const toPct = (arr) => arr.map(v => v == null ? null : v * 100)
    const ds = []

    if (splitEconDis) {
      ds.push(lineDataset({ label: 'Free meals',    data: toPct(econDisSplitShare.freeMeals),    color: COLOR_FREE }))
      ds.push(lineDataset({ label: 'Reduced price', data: toPct(econDisSplitShare.reducedPrice), color: COLOR_REDUCED, dashed: true }))
    } else {
      ds.push(lineDataset({ label: 'Econ Dis', data: toPct(econDisShare), color: COLOR_ECON }))
    }

    ds.push(lineDataset({ label: 'English Learners', data: toPct(elShare), color: COLOR_EL }))

    if (splitSwD) {
      for (const k of ['autism','emotional','intellectual','learning','other','otherHealth','speech']) {
        ds.push(lineDataset({ label: SWD_LABEL[k], data: toPct(swdSplitShare[k]), color: COLOR_SWD_SUB[k] }))
      }
    } else {
      ds.push(lineDataset({ label: 'Students w/ Disabilities', data: toPct(swdShare), color: COLOR_SWD }))
    }
    return { labels, datasets: ds }
  }, [labels, econDisShare, elShare, swdShare, econDisSplitShare, swdSplitShare, splitEconDis, splitSwD])

  const hasAnyShare = shareData.datasets.some(d => d.data.some(v => v != null && !isNaN(v)))

  // ── Right: Overall vs HN ratio (clean 2-line chart) ──────────────────
  const ratiosData = useMemo(() => ({
    labels,
    datasets: [
      lineDataset({ label: 'Overall', data: ratioOverall, color: COLOR_OVERALL }),
      lineDataset({ label: 'High-needs', data: ratioHn, color: COLOR_HN, dashed: true }),
    ],
  }), [labels, ratioOverall, ratioHn])

  const hasAnyRatio = ratioOverall.some(v => v != null && !isNaN(v))
                  || ratioHn.some(v => v != null && !isNaN(v))

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

  const shareOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          title: items => `Year ${items[0].label}`,
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(1) + '%'}`,
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
      <Mini
        title="High-needs share over time"
        empty={!hasAnyShare}
        legend={
          <ShareLegend
            splitEconDis={splitEconDis}
            splitSwD={splitSwD}
            onToggleEconDis={() => setSplitEconDis(v => !v)}
            onToggleSwD={() => setSplitSwD(v => !v)}
          />
        }
        footer={
          <SplitControls
            splitEconDis={splitEconDis}
            splitSwD={splitSwD}
            onToggleEconDis={() => setSplitEconDis(v => !v)}
            onToggleSwD={() => setSplitSwD(v => !v)}
          />
        }
      >
        <Line data={shareData} options={shareOptions} />
      </Mini>
      <Mini
        title={`Books per child · ${AGE_LABELS[age]}`}
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

function ShareLegend({ splitEconDis, splitSwD }) {
  return (
    <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
      {splitEconDis ? (
        <>
          <Swatch color={COLOR_FREE} label="Free" />
          <Swatch color={COLOR_REDUCED} label="Reduced" dashed />
        </>
      ) : (
        <Swatch color={COLOR_ECON} label="Econ Dis" />
      )}
      <Swatch color={COLOR_EL} label="EL" />
      {splitSwD ? (
        <span style={{ color: 'var(--color-text-tertiary)' }}>SwD: 7 types ▾</span>
      ) : (
        <Swatch color={COLOR_SWD} label="SwD" />
      )}
    </div>
  )
}

function SplitControls({ splitEconDis, splitSwD, onToggleEconDis, onToggleSwD }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px]">
      <ExpandPill active={splitEconDis} onClick={onToggleEconDis}>
        Free / Reduced split
      </ExpandPill>
      <ExpandPill active={splitSwD} onClick={onToggleSwD}>
        Disability types
      </ExpandPill>
    </div>
  )
}

function ExpandPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors"
      style={{
        background: active ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
        border: `0.5px solid ${active ? 'var(--color-text-tertiary)' : 'var(--color-border-secondary)'}`,
        color: 'var(--color-text-secondary)',
      }}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center"
        style={{
          width: 14, height: 14, borderRadius: 999,
          border: '0.5px solid var(--color-text-tertiary)',
          fontSize: 11, lineHeight: 1, fontWeight: 600,
        }}
      >
        {active ? '−' : '+'}
      </span>
      {children}
    </button>
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

function Mini({ title, empty, legend, footer, children }) {
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
      {footer}
    </div>
  )
}
