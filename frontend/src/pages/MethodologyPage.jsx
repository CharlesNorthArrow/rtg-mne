import {
  TIER_CONFIG,
  TIER_KEYS,
  TIER_COEFFICIENTS,
  OVERALL_THRESHOLDS,
  HN_THRESHOLDS,
} from '../lib/tiers.js'

const NO_DATA_HATCH =
  'repeating-linear-gradient(45deg, var(--color-border-tertiary) 0 3px, var(--color-background-secondary) 3px 6px)'

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-12" style={{ color: 'var(--color-text-primary)' }}>
      <Header />
      <Section title="What this dashboard measures">
        <Intro />
      </Section>

      <Section title="The 6-tier scale">
        <TierScaleVisual />
        <TierThresholdTables />
      </Section>

      <Section title="What “tier 0” means (and what it doesn’t)">
        <ThreeStateRule />
      </Section>

      <Section title="The age coefficients">
        <CoefficientsExplainer />
      </Section>

      <Section title="The “high-needs” definition">
        <HighNeedsDefinition />
      </Section>

      <Section title="Data sources">
        <DataSourcesTable />
      </Section>

      <Section title="Methodology decisions on record">
        <MethodologyDecisions />
      </Section>

      <Section title="Full methodology document">
        <FullDocPlaceholder />
      </Section>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────
function Header() {
  return (
    <header>
      <h1 className="text-3xl font-semibold leading-tight">Methodology</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        How Read to Grow measures book distribution reach across Connecticut’s
        158 public school districts.
      </p>
    </header>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
        {children}
      </div>
    </section>
  )
}

// ── 1) Intro ───────────────────────────────────────────────────────────
function Intro() {
  return (
    <>
      <p>
        The dashboard answers one question for each Connecticut school district:
        <strong> how many Read to Grow books were distributed per child living in the
        district, in a given year?</strong> We call this the <em>books-per-child ratio</em>.
      </p>
      <p>
        The ratio is computed two ways:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Overall</strong> — books per child in the full 0–9 age range.
        </li>
        <li>
          <strong>High-Needs</strong> — books per <em>high-needs</em> child in the same age range
          (definition below). This adjusts for districts where a larger share of the
          child population qualifies as high-needs.
        </li>
      </ul>
      <p>
        Each district’s ratio is mapped to one of <strong>six tiers</strong>, so the map can be read
        at a glance: dark red = no reach, dark blue = very high reach. The tiers and
        their cutoffs are below.
      </p>
    </>
  )
}

// ── 2) Tier scale visual + tables ──────────────────────────────────────
function TierScaleVisual() {
  return (
    <div className="space-y-4">
      <TierBar label="Overall" thresholds={OVERALL_THRESHOLDS} />
      <TierBar label="High-Needs" thresholds={HN_THRESHOLDS} />
    </div>
  )
}

function TierBar({ label, thresholds }) {
  return (
    <div
      className="p-4"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
      <div className="flex h-8 overflow-hidden" style={{ borderRadius: 4 }}>
        {TIER_KEYS.map(t => (
          <div
            key={t}
            className="flex-1 flex items-center justify-center text-[11px] font-medium"
            style={{
              background: TIER_CONFIG[t].mapColor,
              color: TIER_CONFIG[t].textColor,
            }}
            title={`T${t} · ${TIER_CONFIG[t].label}`}
          >
            T{t}
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
        {thresholds.map(t => (
          <span key={t.tier} className="flex-1 text-center">{t.label}</span>
        ))}
      </div>
      <div className="mt-0.5 flex text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
        {thresholds.map(t => (
          <span key={`${t.tier}-r`} className="flex-1 text-center font-mono">{t.range}</span>
        ))}
      </div>
    </div>
  )
}

function TierThresholdTables() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ThresholdTable title="Overall thresholds" rows={OVERALL_THRESHOLDS} />
      <ThresholdTable title="High-Needs thresholds" rows={HN_THRESHOLDS} />
    </div>
  )
}

function ThresholdTable({ title, rows }) {
  return (
    <div
      className="p-4"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{title}</div>
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ color: 'var(--color-text-tertiary)' }}>
            <th className="text-left font-normal pb-1">Tier</th>
            <th className="text-left font-normal pb-1">Label</th>
            <th className="text-right font-normal pb-1">Books per child</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.tier} className="border-t" style={{ borderColor: 'var(--color-border-tertiary)' }}>
              <td className="py-1.5">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: TIER_CONFIG[r.tier].mapColor, color: TIER_CONFIG[r.tier].textColor }}
                >
                  T{r.tier}
                </span>
              </td>
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{r.range}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 3) Three-state rule ────────────────────────────────────────────────
function ThreeStateRule() {
  return (
    <>
      <p>
        The map distinguishes <strong>three states</strong>, and they’re different on purpose:
      </p>
      <div
        className="p-4"
        style={{
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ color: 'var(--color-text-tertiary)' }}>
              <th className="text-left font-normal pb-1">Books distributed</th>
              <th className="text-left font-normal pb-1">Census known?</th>
              <th className="text-left font-normal pb-1">Tier</th>
              <th className="text-left font-normal pb-1">Meaning</th>
            </tr>
          </thead>
          <tbody>
            <ThreeStateRow books="0" demo="Yes" tier={0} meaning="Measured zero reach" />
            <ThreeStateRow books="More than 0" demo="Yes" tier="1–5" meaning="Measured reach (computed)" />
            <ThreeStateRow books="Any" demo="No" tier={null} meaning="Cannot measure (no denominator)" />
          </tbody>
        </table>
      </div>
      <p>
        Districts that received no books but where we know the child population
        show as <strong>tier 0</strong> (dark red on the map). That’s not “no data” — it’s a
        meaningful measurement: zero books reached children we know are there. The
        only districts that render as hatched no-data are those where we don’t
        have a denominator (typically a very old year, or a year whose Census
        vintage hasn’t been released yet — see H8 below).
      </p>
    </>
  )
}

function ThreeStateRow({ books, demo, tier, meaning }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-border-tertiary)' }}>
      <td className="py-1.5">{books}</td>
      <td className="py-1.5">{demo}</td>
      <td className="py-1.5"><TierStateChip tier={tier} /></td>
      <td className="py-1.5">{meaning}</td>
    </tr>
  )
}

function TierStateChip({ tier }) {
  // Special case: "1–5" means "whatever the math produces" — render the
  // diverging T1–T5 palette as a banded swatch so the row visually shows
  // "a real measured tier".
  if (tier === '1–5') {
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        <span className="inline-flex overflow-hidden rounded" style={{ border: '0.5px solid var(--color-border-tertiary)' }}>
          {[1, 2, 3, 4, 5].map(t => (
            <span
              key={t}
              className="inline-block"
              style={{ width: 12, height: 14, background: TIER_CONFIG[t].mapColor }}
              title={`T${t} · ${TIER_CONFIG[t].label}`}
            />
          ))}
        </span>
        <span className="text-[11px] font-medium">T1–T5</span>
      </span>
    )
  }

  if (tier == null) {
    return (
      <span
        className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
        style={{
          backgroundImage: NO_DATA_HATCH,
          color: 'var(--color-text-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        No data
      </span>
    )
  }

  const cfg = TIER_CONFIG[tier]
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: cfg.mapColor, color: cfg.textColor }}
    >
      T{tier} · {cfg.label}
    </span>
  )
}

// ── 4) Coefficients explainer ──────────────────────────────────────────
function CoefficientsExplainer() {
  const { coeff_0_9, coeff_0_4, coeff_5_9 } = TIER_COEFFICIENTS
  return (
    <>
      <p>
        Not every book distributed by Read to Grow targets the same age range.
        The pipeline applies three <em>age coefficients</em> when computing ratios, so the
        numerator only counts books targeted at the relevant age band.
      </p>
      <div
        className="p-4"
        style={{
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ color: 'var(--color-text-tertiary)' }}>
              <th className="text-left font-normal pb-1">Coefficient</th>
              <th className="text-left font-normal pb-1">Default</th>
              <th className="text-left font-normal pb-1">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <CoeffRow name="coeff_0_9" value={coeff_0_9} desc="Fraction of distributed books targeted at children aged 0–9 (the combined early-literacy window)." />
            <CoeffRow name="coeff_0_4" value={coeff_0_4} desc="Fraction specifically for ages 0–4." />
            <CoeffRow name="coeff_5_9" value={coeff_5_9} desc="Fraction specifically for ages 5–9." />
          </tbody>
        </table>
        <p className="mt-3 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Invariant: <span className="font-mono">coeff_0_4 + coeff_5_9 = coeff_0_9</span>.
          With defaults: {coeff_0_4} + {coeff_5_9} = {coeff_0_9}. The remaining{' '}
          <span className="font-mono">{(1 - coeff_0_9).toFixed(2)}</span> of distributed books targets ages 10+
          and doesn’t factor into the 0–9 ratios.
        </p>
      </div>
      <p>
        <strong>Worked example.</strong> If a district distributed 100 books over its
        3-year rolling window and has 250 children aged 0–9, the Overall ratio
        is <span className="font-mono">(100 × 0.80) / 250 = 0.32</span> books per child — putting it in tier{' '}
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: TIER_CONFIG[3].mapColor, color: TIER_CONFIG[3].textColor }}
        >
          T3 · {TIER_CONFIG[3].label}
        </span> for the Overall threshold table above.
      </p>
    </>
  )
}

function CoeffRow({ name, value, desc }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-border-tertiary)' }}>
      <td className="py-1.5 font-mono">{name}</td>
      <td className="py-1.5 font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{value.toFixed(2)}</td>
      <td className="py-1.5">{desc}</td>
    </tr>
  )
}

// ── 5) High-Needs definition ───────────────────────────────────────────
function HighNeedsDefinition() {
  return (
    <>
      <p>
        A student is counted as <strong>high-needs</strong> under Connecticut State Department of
        Education (CSDE) reporting if they meet <strong>any one</strong> of the following:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Economically disadvantaged</strong> — eligible for free/reduced-price meals
          (the standard income proxy), or in a household receiving HUSKY (Medicaid), TANF, or SNAP.
        </li>
        <li>
          <strong>English learner</strong> — identified as needing English-language instruction services.
        </li>
        <li>
          <strong>Student with a disability</strong> — receiving special education services under an IEP or §504 plan.
        </li>
      </ul>
      <p>
        Each district reports a single <span className="font-mono">doe_high_needs_pct</span> per year (the share
        of total enrolled students meeting any of the three). The High-Needs ratio uses
        this percentage to estimate the high-needs child population:{' '}
        <span className="font-mono">census_pop_0_9 × doe_high_needs_pct</span>.
      </p>
      <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        Source: CSDE Performance Office, EdSight portal. Definition is current as of
        the latest public EdSight release; we update annually when the new report drops.
      </p>
    </>
  )
}

// ── 6) Data sources ────────────────────────────────────────────────────
function DataSourcesTable() {
  return (
    <div
      className="p-4 overflow-x-auto"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <table className="w-full text-[12px] min-w-[640px]">
        <thead>
          <tr style={{ color: 'var(--color-text-tertiary)' }}>
            <th className="text-left font-normal pb-1">Source</th>
            <th className="text-left font-normal pb-1">What we use</th>
            <th className="text-left font-normal pb-1">Coverage</th>
            <th className="text-left font-normal pb-1">How it’s updated</th>
          </tr>
        </thead>
        <tbody>
          <DataRow
            source="Read to Grow HUB (BFK + Bookmobile)"
            what="Per-distribution rows with date, quantity, latitude/longitude, and program tag"
            coverage="2004 onwards; books distributed in CT only"
            updated="Annual CSV export from HUB, uploaded by Data Director via /admin/upload. Each upload covers one new year and triggers spatial-join + tier recompute."
          />
          <DataRow
            source="CT State Dept. of Education (EdSight)"
            what="District-level enrollment + high-needs counts"
            coverage="2009 onwards; 158 CT public-school districts"
            updated="Annual .xlsx export from EdSight, uploaded via /admin/upload."
          />
          <DataRow
            source="U.S. Census ACS 5-Year (B01001 age × sex table)"
            what="Population aged 0–4 and 5–9 per district"
            coverage="2009 onwards; vintages released ~Dec each year for the prior 5-year window"
            updated="Server-side fetch from api.census.gov via /admin/census-refresh. When the current year’s vintage isn’t out, the previous vintage is carried forward and the row is flagged as a proxy (see H8 below)."
          />
          <DataRow
            source="U.S. Census TIGER/Line (composite of unsd + elsd)"
            what="School-district polygons used for spatial join and the map"
            coverage="158 CT districts; static within the platform"
            updated="Baked in as frontend/public/composite_simplified.geojson (132 KB, simplified via mapshaper) and backend/data/composite_unsd_elsd.geojson (full-resolution)."
          />
        </tbody>
      </table>
    </div>
  )
}

function DataRow({ source, what, coverage, updated }) {
  return (
    <tr className="border-t align-top" style={{ borderColor: 'var(--color-border-tertiary)' }}>
      <td className="py-2 pr-3 font-medium">{source}</td>
      <td className="py-2 pr-3">{what}</td>
      <td className="py-2 pr-3" style={{ color: 'var(--color-text-secondary)' }}>{coverage}</td>
      <td className="py-2" style={{ color: 'var(--color-text-secondary)' }}>{updated}</td>
    </tr>
  )
}

// ── 7) Methodology decisions ───────────────────────────────────────────
function MethodologyDecisions() {
  return (
    <>
      <p>
        Two methodology decisions are currently active. Both are documented in
        the repo at <span className="font-mono text-[12px]">docs/ASSUMPTIONS.md</span> with full reasoning.
      </p>
      <DecisionCard
        id="G1+D2"
        title="Full cross-product panel — measured no-reach is real"
        rule="Every (district, year) cell exists, even when no books were distributed. A district with zero books and a known child population gets tier 0 (“measured no reach”) rather than being dropped from the panel."
        impact="The map now shows districts that genuinely received zero books as dark red, instead of hiding them as hatched no-data. Both Overall and High-Needs views follow this rule — zero books reach zero of anyone."
        implementation="backend/src/services/pipeline.js (zeroReach guard) + backend/scripts/expand-panel.js (one-shot backfill, 231 cells added) + backend/scripts/recompute-zero-reach.js (HN tier sub-fix)."
        accepted="2026-05-21"
      />
      <DecisionCard
        id="H8"
        title="Census proxy carry-forward"
        rule="When the current year’s Census ACS vintage hasn’t been published yet, the previous vintage’s population values are carried forward as the denominator, and the row is flagged as a proxy."
        impact="The 2025 panel year is visible on the dashboard right now, using 2024 Census data. The small “Census 2024” label next to the year slider and inside the district header tells you which vintage produced the ratio."
        implementation="backend/src/services/pipeline.js (applyProxyCensus) — runs after every /upload-books, /census-refresh, and config recompute. Caps at one year (gap > 1 is refused; would require a fresh decision H8b)."
        accepted="2026-05-21"
      />
    </>
  )
}

function DecisionCard({ id, title, rule, impact, implementation, accepted }) {
  return (
    <div
      className="p-4 space-y-2"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">
          <span className="font-mono text-[12px] mr-2" style={{ color: 'var(--color-text-tertiary)' }}>{id}</span>
          {title}
        </div>
        <span className="text-[10px] uppercase tabular-nums shrink-0" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
          Accepted {accepted}
        </span>
      </div>
      <p><strong>Rule.</strong> {rule}</p>
      <p><strong>What changes for you.</strong> {impact}</p>
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Implementation: <span className="font-mono">{implementation}</span>
      </p>
    </div>
  )
}

// ── 8) Full doc placeholder ────────────────────────────────────────────
function FullDocPlaceholder() {
  return (
    <div
      className="p-4 flex items-center justify-between gap-4"
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px dashed var(--color-border-tertiary)',
      }}
    >
      <div>
        <div className="font-medium">Full methodology PDF</div>
        <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          A printable, citation-ready PDF version is coming soon.
        </div>
      </div>
      <button
        type="button"
        disabled
        className="rounded-md px-3 py-1.5 text-sm font-medium cursor-not-allowed"
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          color: 'var(--color-text-tertiary)',
        }}
        title="Coming soon"
      >
        Download (coming soon)
      </button>
    </div>
  )
}
