import { fmtBpc, fmtDeltaParts, fmtInt } from '../../lib/format.js'
import { TIER_CONFIG } from '../../lib/tiers.js'

const SIGN_COLOR = {
  positive: '#16A34A',  // green-600
  negative: '#DC2626',  // red-600
  neutral:  'var(--color-text-tertiary)',
}

export default function KpiStrip({ kpis, onPickDistrict }) {
  const c = kpis.current
  const p = kpis.prior

  // Compute the share of reached districts (primary metric for that card)
  const reachedPct = c && c.total > 0
    ? Math.round((c.reached / c.total) * 100)
    : null

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1 — three primary cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card
          label="Books distributed"
          primary={c ? fmtInt(c.books) : '—'}
          delta={p && c ? fmtDeltaParts(c.books, p.books, 'int') : null}
        />
        <Card
          label="Districts reached"
          primary={reachedPct != null ? `${reachedPct}%` : '—'}
          secondary={c ? `${fmtInt(c.reached)} of ${fmtInt(c.total)}` : null}
          delta={p && c ? fmtDeltaParts(c.reached, p.reached, 'int') : null}
        />
        <Card
          label="Avg books per child"
          primary={c && c.avgBpc != null ? fmtBpc(c.avgBpc) : '—'}
          secondary="ages 0–9"
          delta={p && c && c.avgBpc != null && p.avgBpc != null ? fmtDeltaParts(c.avgBpc, p.avgBpc, 'float') : null}
        />
      </div>

      {/* Row 2 — two list cards */}
      <div className="grid grid-cols-2 gap-2">
        <ListCard
          kind="low"
          label="Low reach (T0–1)"
          count={c?.low}
          delta={p && c ? fmtDeltaParts(c.low, p.low, 'int') : null}
          listLabel="Bottom 5 by ratio"
          items={kpis.bottom}
          onPick={onPickDistrict}
        />
        <ListCard
          kind="high"
          label="High reach (T4–5)"
          count={c?.high}
          delta={p && c ? fmtDeltaParts(c.high, p.high, 'int') : null}
          listLabel="Top 5 by ratio"
          items={kpis.top}
          onPick={onPickDistrict}
        />
      </div>
    </div>
  )
}

function DeltaBlock({ delta }) {
  return (
    <div className="text-right tabular-nums">
      <div
        className="text-[9px] uppercase leading-tight"
        style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
      >
        vs last year
      </div>
      {delta ? (
        <>
          <div className="text-[12px] font-medium leading-tight" style={{ color: SIGN_COLOR[delta.sign] }}>{delta.abs}</div>
          <div className="text-[10px] leading-tight" style={{ color: SIGN_COLOR[delta.sign] }}>{delta.pct}</div>
        </>
      ) : (
        <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>—</div>
      )}
    </div>
  )
}

function Card({ label, primary, secondary, delta }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-md, 8px)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase"
          style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}
        >
          {label}
        </div>
        <div
          className="font-medium tabular-nums leading-tight"
          style={{ fontSize: 22, color: 'var(--color-text-primary)' }}
        >
          {primary}
        </div>
        {secondary && (
          <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {secondary}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <DeltaBlock delta={delta} />
      </div>
    </div>
  )
}

// Reach-bucket presentation: low-reach cards tint red and treat positive
// deltas as bad (more low-reach districts = bad); high-reach cards tint
// blue and treat positive deltas as good.
const REACH_KIND = {
  low:  { tint: 'rgba(178, 24, 43, 0.06)', goodWhen: 'down' },
  high: { tint: 'rgba(33, 102, 172, 0.06)', goodWhen: 'up'   },
}

function ListCard({ kind, label, count, delta, listLabel, items, onPick }) {
  const { tint, goodWhen } = REACH_KIND[kind]
  return (
    <div
      className="flex gap-3 px-3 py-2"
      style={{
        background: tint,
        borderRadius: 'var(--radius-md, 8px)',
      }}
    >
      {/* Left: indicator (label, count, delta on right of count) */}
      <div className="shrink-0 flex flex-col justify-center" style={{ minWidth: 90 }}>
        <div
          className="text-[10px] uppercase"
          style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}
        >
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <div
            className="font-medium tabular-nums leading-tight"
            style={{ fontSize: 22, color: 'var(--color-text-primary)' }}
          >
            {count ?? '—'}
          </div>
        </div>
        <div className="mt-0.5">
          <DeltaBlockLeft delta={delta} goodWhen={goodWhen} />
        </div>
      </div>

      {/* Right: list */}
      <div
        className="flex-1 min-w-0 border-l pl-3"
        style={{ borderColor: 'var(--color-border-tertiary)' }}
      >
        <div
          className="text-[9px] uppercase"
          style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
        >
          {listLabel}
        </div>
        <ol className="mt-0.5 space-y-0.5 text-[11px]" style={{ color: 'var(--color-text-primary)' }}>
          {items && items.length > 0 ? items.map((it, i) => (
            <li
              key={it.geoid}
              onClick={onPick ? () => onPick(it.geoid) : undefined}
              className={onPick ? 'cursor-pointer hover:bg-white/60 rounded px-1' : 'px-1'}
              title={onPick ? 'Select on map' : undefined}
            >
              <div className="flex items-baseline gap-1.5">
                <span style={{ color: 'var(--color-text-tertiary)', minWidth: 12, display: 'inline-block' }}>{i + 1}.</span>
                <span
                  className="inline-block h-2 w-2 rounded-sm shrink-0"
                  style={{ background: TIER_CONFIG[it.tier]?.mapColor ?? '#E5E7EB' }}
                />
                <span className="flex-1 truncate">{it.name}</span>
                <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {it.ratio.toFixed(3)}
                </span>
              </div>
            </li>
          )) : (
            <li className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>No data.</li>
          )}
        </ol>
      </div>
    </div>
  )
}

// In ListCard the delta sits below the count and aligns left (not right) so it
// reads as part of the indicator stack.
// goodWhen='up' (default): positive change is good (green). goodWhen='down':
// positive change is bad (red) — used by the Low-reach card where more
// districts in low reach is a negative outcome.
function DeltaBlockLeft({ delta, goodWhen = 'up' }) {
  if (!delta) return <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>—</div>
  const semanticSign = goodWhen === 'down' && delta.sign !== 'neutral'
    ? (delta.sign === 'positive' ? 'negative' : 'positive')
    : delta.sign
  const color = SIGN_COLOR[semanticSign]
  return (
    <div className="tabular-nums">
      <span className="text-[11px] font-medium" style={{ color }}>{delta.abs}</span>
      {delta.pct && (
        <span className="ml-1 text-[10px]" style={{ color }}>{delta.pct}</span>
      )}
    </div>
  )
}
