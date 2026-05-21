import { useEffect, useMemo, useRef, useState } from 'react'
import { TIER_CONFIG, getTierColor } from '../../../lib/tiers.js'

// Bespoke SVG chart. One bar per year between the first and last data year
// for this district. Bar height encodes tier (T0 shortest → T5 full height)
// AND bar color encodes tier. Striped baseline marks no-data years.
//
// Secondary y-axis (right side): single-year books distributed,
// drawn as a faint line overlay so the bar story and the volume story
// can be read together.

const HEIGHT     = 170
const PAD_TOP    = 14
const PAD_BOTTOM = 26
const PAD_LEFT   = 12
const PAD_RIGHT  = 44   // wider to fit right-axis tick labels
const BAR_GAP    = 2
const TIER_LEVELS = 6   // T0..T5
const FALLBACK_W = 400

const BOOKS_LINE_COLOR = '#374151'   // muted slate; "faint" achieved via opacity
const BOOKS_LINE_OPACITY = 0.55
const BOOKS_AXIS_COLOR = '#6B7280'

// Round up to a "nice" ceiling for the books axis.
function niceCeiling(v) {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  let step
  if (n <= 1) step = 1
  else if (n <= 2) step = 2
  else if (n <= 5) step = 5
  else step = 10
  return step * pow
}

export default function LifetimeTiers({ lifetime, tierOf, selectedYear }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(FALLBACK_W)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const years = lifetime.map(d => d.year)
  const yMin  = years[0]
  const yMax  = years[years.length - 1]

  const ticks = useMemo(() => {
    if (yMin == null) return []
    const s = new Set([yMin, yMax])
    for (let y = Math.ceil(yMin / 5) * 5; y <= yMax; y += 5) s.add(y)
    return [...s].sort((a, b) => a - b)
  }, [yMin, yMax])

  // Books overlay: max + nice ceiling
  const maxBooks = useMemo(() => {
    let m = 0
    for (const { row, isNoData } of lifetime) {
      if (isNoData || !row) continue
      const b = row.books_combined
      if (b != null && b > m) m = b
    }
    return m
  }, [lifetime])
  const booksCeil = useMemo(() => niceCeiling(maxBooks || 1), [maxBooks])
  const hasAnyBooks = maxBooks > 0

  if (lifetime.length === 0) {
    return (
      <Wrapper containerRef={containerRef} title="Tier lifetime">
        <div className="flex flex-1 items-center justify-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          No tier data for this district yet.
        </div>
      </Wrapper>
    )
  }

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1)
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slotW = plotW / lifetime.length
  const barW  = Math.max(slotW - BAR_GAP, 1)

  const xForYear = (year) => {
    const span = yMax - yMin
    if (span <= 0) return PAD_LEFT + plotW / 2
    return PAD_LEFT + ((year - yMin) / span) * plotW
  }
  const yForBooks = (b) => (HEIGHT - PAD_BOTTOM) - (b / booksCeil) * plotH

  // Build line path, lifting pen across null / no-data years
  const linePath = useMemo(() => {
    let cmd = ''
    let penDown = false
    for (const { year, row, isNoData } of lifetime) {
      const b = (!isNoData && row && row.books_combined != null) ? row.books_combined : null
      if (b == null) { penDown = false; continue }
      const x = xForYear(year)
      const y = yForBooks(b)
      cmd += `${penDown ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
      penDown = true
    }
    return cmd.trim()
  // xForYear / yForBooks close over width + booksCeil; depend on those
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifetime, width, booksCeil])

  // Dots at each non-null point so single-year districts still read
  const dots = useMemo(() => {
    const out = []
    for (const { year, row, isNoData } of lifetime) {
      const b = (!isNoData && row && row.books_combined != null) ? row.books_combined : null
      if (b == null) continue
      out.push({ year, cx: xForYear(year), cy: yForBooks(b), books: b })
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifetime, width, booksCeil])

  return (
    <Wrapper containerRef={containerRef} title={`Tier lifetime · ${yMin}–${yMax}`}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        style={{ display: 'block' }}
      >
        <defs>
          <pattern
            id="lifetime-nodata"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#F3F4F6" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#D1D5DB" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* Tier reference lines (T0–T5) */}
        {Array.from({ length: TIER_LEVELS }, (_, i) => i).map(i => {
          const y = PAD_TOP + plotH * (1 - (i + 1) / TIER_LEVELS)
          return (
            <line
              key={i}
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="1"
            />
          )
        })}

        {/* Bars */}
        {lifetime.map(({ year, row, isNoData }) => {
          const cx = PAD_LEFT + (year - yMin + 0.5) * slotW
          const x  = cx - barW / 2

          if (isNoData) {
            const h = plotH * 0.08
            const y = HEIGHT - PAD_BOTTOM - h
            return (
              <rect key={year} x={x} y={y} width={barW} height={h} fill="url(#lifetime-nodata)">
                <title>{`${year} — no data`}</title>
              </rect>
            )
          }

          const tier = tierOf(row)
          if (tier == null) {
            const h = plotH * 0.08
            const y = HEIGHT - PAD_BOTTOM - h
            return (
              <rect key={year} x={x} y={y} width={barW} height={h} fill="url(#lifetime-nodata)">
                <title>{`${year} — tier not computed`}</title>
              </rect>
            )
          }

          const h = plotH * ((tier + 1) / TIER_LEVELS)
          const y = HEIGHT - PAD_BOTTOM - h
          return (
            <rect key={year} x={x} y={y} width={barW} height={h} fill={getTierColor(tier)}>
              <title>{`${year} — T${tier} ${TIER_CONFIG[tier].label}`}</title>
            </rect>
          )
        })}

        {/* Books-distributed overlay (faint line + dots) */}
        {hasAnyBooks && (
          <g opacity={BOOKS_LINE_OPACITY} style={{ pointerEvents: 'none' }}>
            <path
              d={linePath}
              fill="none"
              stroke={BOOKS_LINE_COLOR}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dots.map(d => (
              <circle
                key={d.year}
                cx={d.cx}
                cy={d.cy}
                r="2"
                fill={BOOKS_LINE_COLOR}
              />
            ))}
          </g>
        )}
        {/* Tooltips for the books overlay (rendered with full pointer events) */}
        {hasAnyBooks && dots.map(d => (
          <circle
            key={`hit-${d.year}`}
            cx={d.cx}
            cy={d.cy}
            r="6"
            fill="transparent"
          >
            <title>{`${d.year} — ${Math.round(d.books).toLocaleString('en-US')} books distributed`}</title>
          </circle>
        ))}

        {/* Right axis: books ticks (0 + ceiling). Sits in PAD_RIGHT margin. */}
        {hasAnyBooks && (
          <g fontFamily="system-ui, sans-serif" fontSize="9" fill={BOOKS_AXIS_COLOR}>
            <text x={width - PAD_RIGHT + 4} y={HEIGHT - PAD_BOTTOM + 3} textAnchor="start">
              0
            </text>
            <text x={width - PAD_RIGHT + 4} y={PAD_TOP + 3} textAnchor="start">
              {fmtAxis(booksCeil)}
            </text>
            <text
              x={width - 2}
              y={PAD_TOP + plotH / 2}
              textAnchor="end"
              transform={`rotate(-90 ${width - 2} ${PAD_TOP + plotH / 2})`}
              fill={BOOKS_AXIS_COLOR}
              opacity="0.8"
            >
              books / yr
            </text>
          </g>
        )}

        {/* Selected-year dashed line */}
        {selectedYear != null && selectedYear >= yMin && selectedYear <= yMax && (
          <line
            x1={xForYear(selectedYear)}
            x2={xForYear(selectedYear)}
            y1={PAD_TOP - 4}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* X-axis baseline */}
        <line
          x1={PAD_LEFT}
          x2={width - PAD_RIGHT}
          y1={HEIGHT - PAD_BOTTOM}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#9CA3AF"
          strokeWidth="1"
        />

        {/* X-axis ticks + labels */}
        {ticks.map(t => {
          const x = xForYear(t)
          return (
            <g key={t}>
              <line
                x1={x}
                x2={x}
                y1={HEIGHT - PAD_BOTTOM}
                y2={HEIGHT - PAD_BOTTOM + 4}
                stroke="#9CA3AF"
                strokeWidth="1"
              />
              <text
                x={x}
                y={HEIGHT - PAD_BOTTOM + 16}
                fontSize="11"
                fill="#6B7280"
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
              >
                {t}
              </text>
            </g>
          )
        })}
      </svg>

      <LifetimeLegend hasBooks={hasAnyBooks} />
    </Wrapper>
  )
}

function fmtAxis(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

function Wrapper({ containerRef, title, children }) {
  return (
    <div
      ref={containerRef}
      className="flex flex-col px-4 py-3"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function LifetimeLegend({ hasBooks }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
      <span className="flex items-center gap-1.5">
        <span>Lower tier</span>
        {[0, 1, 2, 3, 4, 5].map(t => (
          <span
            key={t}
            className="inline-block"
            style={{
              width: 12,
              height: 4 + t * 2,
              background: getTierColor(t),
            }}
            title={`T${t} · ${TIER_CONFIG[t].label}`}
          />
        ))}
        <span>Higher tier</span>
      </span>
      {hasBooks && (
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: 'inline-block',
              width: 18,
              height: 0,
              borderTop: `1.5px solid ${BOOKS_LINE_COLOR}`,
              opacity: BOOKS_LINE_OPACITY,
            }}
          />
          Books distributed / year
        </span>
      )}
    </div>
  )
}
