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
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-10" style={{ color: 'var(--color-text-primary)' }}>
      <Header />
      <LevelSelector />
      <ExecutiveSummary />
      <Section id="walkthrough" title="What does the dashboard show?">
        <WhatThisShows />
      </Section>
      <Section title="How we group districts into tiers">
        <TierSystem />
      </Section>
      <Section title="What “Data unavailable” means">
        <DataUnavailableNote />
      </Section>
      <Section title="What the numbers can, and can’t, tell you">
        <Limitations />
      </Section>
      <Section title="Where the data comes from">
        <WhereDataComesFrom />
      </Section>

      <TechnicallyCurious />

      <FullDocPlaceholder />
    </div>
  )
}

// ── Level selector ─────────────────────────────────────────────────────
function LevelSelector() {
  const jumpTo = (target) => (e) => {
    e.preventDefault()
    const el = document.getElementById(target)
    if (!el) return
    if (el.tagName === 'DETAILS') el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const linkStyle = { color: 'var(--color-brand-blue, #243A78)' }
  return (
    <div className="-mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      How much detail do you want?{' '}
      <a href="#overview" onClick={jumpTo('overview')} className="underline" style={linkStyle}>
        1-minute overview
      </a>
      {' · '}
      <a href="#walkthrough" onClick={jumpTo('walkthrough')} className="underline" style={linkStyle}>
        5-minute walkthrough
      </a>
      {' · '}
      <a href="#technical" onClick={jumpTo('technical')} className="underline" style={linkStyle}>
        Technical detail
      </a>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────
function Header() {
  return (
    <header>
      <h1 className="text-3xl font-semibold leading-tight">About this dashboard</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Read to Grow’s book-distribution reach across Connecticut’s 158 public school districts.
      </p>
    </header>
  )
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

// ── Executive summary ──────────────────────────────────────────────────
function ExecutiveSummary() {
  return (
    <section
      id="overview"
      className="px-5 py-5 space-y-4 text-[15px] leading-relaxed scroll-mt-6"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
        <span aria-hidden="true">💡</span>
        <span>How We Measure Our Reach</span>
        <span
          className="text-sm font-normal"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          (one-minute methodology)
        </span>
      </h2>
      <p>
        Read to Grow’s mission is to promote language skills and literacy for Connecticut’s children, beginning at birth, by ensuring that every family, regardless of circumstance, has books at home and the knowledge to use them. Since 1998, we have distributed more than 2.4 million books across the state through our Books for Kids and Bookmobile programs. This dashboard is how we measure whether those books are reaching the children who need them most.
      </p>
      <p>
        For each of Connecticut’s 158 school districts, we calculate a reach ratio: the estimated number of books distributed per child aged 0–9, based on a three-year average of our distribution data. Using a three-year window reduces the effect of any single unusual year and gives a more stable picture of our presence in each community. We report this ratio for all children in a district and separately for high-needs children (those who are economically disadvantaged, English learners, or students with disabilities), because equitable reach matters as much as overall reach. Each of those three subgroups is also reported separately in district detail and can be used to filter the map.
      </p>
      <RatioDiagram />
      <p>
        Each district is assigned a tier from 0 to 5 based on where its ratio falls against a fixed set of benchmarks. These benchmarks do not change from year to year. That is deliberate: a district moving from Tier 2 to Tier 3 represents real growth in our reach, not a shift in how we define the tiers. Districts we have not yet reached are included at Tier 0, so no community is left out of the picture.
      </p>
      <TierMappingDiagram />
    </section>
  )
}

// ── Ratio diagram (after exec-summary paragraph 2) ─────────────────────
function RatioDiagram() {
  return (
    <div
      className="p-4 my-2"
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Example: District A — how the ratio is computed
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">👶</span>
          <span><strong>200</strong> children aged 0–9</span>
        </span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">🎯</span>
          <span><strong>50</strong> of them high-needs</span>
        </span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">📚</span>
          <span><strong>60</strong> books distributed</span>
        </span>
      </div>

      <RatioRow label="Overall"    numerator={60} denominator={200} result={0.30} tier={4} />
      <RatioRow label="High-Needs" numerator={60} denominator={50}  result={1.20} tier={5} />
    </div>
  )
}

function RatioRow({ label, numerator, denominator, result, tier }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[14px]">
      <span className="w-24 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="font-mono tabular-nums">
        {numerator} <span style={{ color: 'var(--color-text-tertiary)' }}>÷</span> {denominator}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--color-text-tertiary)' }}>→</span>
      <span className="font-mono tabular-nums font-semibold">{result.toFixed(2)}</span>
      <span aria-hidden="true" style={{ color: 'var(--color-text-tertiary)' }}>→</span>
      <span
        className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
        style={{ background: cfg.mapColor, color: cfg.textColor }}
      >
        T{tier} · {cfg.label}
      </span>
    </div>
  )
}

// ── Tier-mapping diagram (after exec-summary paragraph 3) ──────────────
function TierMappingDiagram() {
  return (
    <div
      className="p-4 my-2"
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        How two districts land in different tiers
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <DistrictCard
          name="District A"
          kids={200}
          books={60}
          ratio={0.30}
          tier={4}
          note="Good reach"
        />
        <DistrictCard
          name="District B"
          kids={400}
          books={8}
          ratio={0.02}
          tier={2}
          note="Much smaller reach"
        />
      </div>

      <div>
        <div className="flex h-6 overflow-hidden" style={{ borderRadius: 4 }}>
          {TIER_KEYS.map(t => (
            <div
              key={t}
              className="flex-1 flex items-center justify-center text-[10px] font-medium"
              style={{ background: TIER_CONFIG[t].mapColor, color: TIER_CONFIG[t].textColor }}
            >
              T{t}
            </div>
          ))}
        </div>
        <div className="flex mt-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {TIER_KEYS.map(t => (
            <span key={t} className="flex-1 text-center">
              {t === 2 ? '▲ District B' : t === 4 ? '▲ District A' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function DistrictCard({ name, kids, books, ratio, tier, note }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <div
      className="p-3 text-sm"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      <div className="font-medium mb-1">{name}</div>
      <div className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        <span aria-hidden="true">👶</span> {kids} children
        <span className="mx-1" style={{ color: 'var(--color-text-tertiary)' }}>·</span>
        <span aria-hidden="true">📚</span> {books} books
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-mono tabular-nums">{ratio.toFixed(2)} BPC</span>
        <span aria-hidden="true" style={{ color: 'var(--color-text-tertiary)' }}>→</span>
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: cfg.mapColor, color: cfg.textColor }}
        >
          T{tier} · {cfg.label}
        </span>
      </div>
      <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
        {note}
      </div>
    </div>
  )
}

// ── What it shows ──────────────────────────────────────────────────────
function WhatThisShows() {
  return (
    <>
      <p>
        For each Connecticut school district, the dashboard reports one number: how many <strong>books per child</strong> Read to Grow distributed within that district over the most recent three years. We use a <strong>3-year average</strong> because a single big distribution shouldn’t make a district look like a stable success, and a slow year shouldn’t erase real progress.
      </p>
      <p>
        That number is grouped into one of six tiers, from <strong>no reach</strong> (dark red) to <strong>very high reach</strong> (dark blue). The color of each district on the map tells the story at a glance.
      </p>
      <p>
        You can switch between two views:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Overall:</strong> books per child across the full 0–9 age range.
        </li>
        <li>
          <strong>High-Needs:</strong> books per high-needs child in that same age range. The state of Connecticut counts a student as high-needs if their family qualifies for free or reduced-price meals, if they are learning English at school, or if they receive special education services.
        </li>
      </ul>
      <p>
        Only books distributed through the <strong>Bookmobile</strong> and <strong>Books for Kids</strong> programs are counted here. Other Read to Grow work (events, in-clinic giveaways, partner programs) isn’t yet in these numbers.
      </p>
    </>
  )
}

// ── Tier system ────────────────────────────────────────────────────────
function TierSystem() {
  return (
    <>
      <TierBar label="Overall view" />
      <TierBar label="High-Needs view" />
      <p>
        <strong>The cutoffs between tiers are the same every year.</strong> We don’t simply rank Connecticut’s districts and split them into six groups; the line between <em>moderate</em> and <em>high reach</em>, for example, is a fixed books-per-child number that doesn’t move from one year to the next.
      </p>
      <p>
        This means a district’s tier reflects real progress over time, not just how it compares to other districts in a given year. A district moving from <em>low</em> to <em>moderate</em> is a real change in book reach, not a side effect of what happened elsewhere.
      </p>
    </>
  )
}

function TierBar({ label }) {
  return (
    <div
      className="p-4 mb-2"
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
          >
            T{t}
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {TIER_KEYS.map(t => (
          <span key={t} className="flex-1 text-center">{TIER_CONFIG[t].label}</span>
        ))}
      </div>
    </div>
  )
}

// ── Data unavailable note ──────────────────────────────────────────────
function DataUnavailableNote() {
  return (
    <>
      <p>
        Some districts in some years appear with a hatched grey pattern on the map and a “data unavailable” note. This happens when one of the data sources behind the books-per-child number (the state’s enrollment data or the U.S. Census population estimates) doesn’t yet cover that district or that year.
      </p>
      <p>
        <strong>“Data unavailable” is not the same as “no reach.”</strong> It does not mean Read to Grow hasn’t served children there. It means we can’t fairly calculate a books-per-child number without all the inputs. Districts where we measured zero distributions are shown in dark red as <em>no reach</em>. That is a real, deliberate finding, distinct from missing data.
      </p>
    </>
  )
}

// ── What the numbers can / can't tell you ──────────────────────────────
function Limitations() {
  return (
    <>
      <p>
        Reach is measured by <strong>where books are distributed, not where the children who receive them live</strong>. Each distribution is matched to a Connecticut school district by where it took place. This is a useful picture at the population level, but it isn’t a guarantee about any individual child.
      </p>
      <p>
        Families cross district lines all the time, for libraries, schools, clinics, and community events. A district shown as low or no reach may still have children who received our books at a nearby distribution just across the border. The reverse is also true: a high-reach district’s number includes books that may have gone home with children living in neighboring towns. Use these numbers as a guide to where the work is concentrated, not as a measurement of who specifically received a book.
      </p>
    </>
  )
}

// ── Where the data comes from ──────────────────────────────────────────
function WhereDataComesFrom() {
  return (
    <>
      <p>
        Three sources, one combined picture:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Read to Grow’s own records.</strong> Every Bookmobile and Books for Kids distribution, with the date, the number of books, and the location, exported once a year from RTG’s program-tracking system.
        </li>
        <li>
          <strong>Connecticut State Department of Education.</strong> Yearly enrollment counts for each public school district, and the share of students the state identifies as high-needs. Published on the state’s EdSight portal.
        </li>
        <li>
          <strong>U.S. Census Bureau.</strong> Population estimates for the number of children aged 0–4 and 5–9 living in each Connecticut school district, updated each year.
        </li>
      </ul>
      <p>
        District boundaries follow Connecticut’s 158 official public school district shapes, the same boundaries the state uses.
      </p>
    </>
  )
}

// ── Technically-curious collapsible ────────────────────────────────────
function TechnicallyCurious() {
  return (
    <section>
      <details
        id="technical"
        className="px-5 py-4 scroll-mt-6"
        style={{
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <summary
          className="cursor-pointer text-base font-semibold select-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          For the technically curious
        </summary>
        <div className="mt-5 space-y-7 text-sm leading-relaxed">
          <TechTierCutoffs />
          <TechAgeShares />
          <TechThreeState />
          <TechDataSources />
          <TechDecisions />
        </div>
      </details>
    </section>
  )
}

// ── Tech: exact tier cutoffs ───────────────────────────────────────────
function TechTierCutoffs() {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Exact tier cutoffs</h3>
      <p className="mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Books per child is computed against the relevant Census population. The
        cutoffs are absolute (not quantile-based) so a district’s tier is comparable
        across years.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CutoffTable title="Overall thresholds" rows={OVERALL_THRESHOLDS} />
        <CutoffTable title="High-Needs thresholds" rows={HN_THRESHOLDS} />
      </div>
    </div>
  )
}

function CutoffTable({ title, rows }) {
  return (
    <div
      className="p-4"
      style={{
        background: 'var(--color-background-secondary)',
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
              <td className="py-1.5 text-right font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {r.range}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tech: age-share math ───────────────────────────────────────────────
function TechAgeShares() {
  const { coeff_0_9, coeff_0_4, coeff_5_9 } = TIER_COEFFICIENTS
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Age-share calculation</h3>
      <p className="mb-2">
        Not every book Read to Grow distributes is for children aged 0–9. The
        pipeline applies an estimated share of books to each age band so the
        numerator only counts books targeted at the relevant ages.
      </p>
      <ul className="list-disc pl-5 space-y-1 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        <li><span className="font-mono">share_0_9 = {coeff_0_9.toFixed(2)}</span>: share of distributed books targeting ages 0–9.</li>
        <li><span className="font-mono">share_0_4 = {coeff_0_4.toFixed(2)}</span>: within that, share for 0–4.</li>
        <li><span className="font-mono">share_5_9 = {coeff_5_9.toFixed(2)}</span>: within that, share for 5–9.</li>
      </ul>
      <p className="mb-2">
        Invariant: <span className="font-mono">share_0_4 + share_5_9 = share_0_9</span>. The remaining{' '}
        <span className="font-mono">{(1 - coeff_0_9).toFixed(2)}</span> targets ages 10+ and doesn’t enter the 0–9 numbers.
      </p>
      <p>
        <strong>Worked example.</strong> A district distributed 100 books over its 3-year window and has 250 children aged 0–9.
        Overall books per child ={' '}
        <span className="font-mono">(100 × {coeff_0_9.toFixed(2)}) / 250 = {((100 * coeff_0_9) / 250).toFixed(3)}</span>{' '}
        → tier{' '}
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: TIER_CONFIG[3].mapColor, color: TIER_CONFIG[3].textColor }}
        >
          T3 · {TIER_CONFIG[3].label}
        </span>.
      </p>
    </div>
  )
}

// ── Tech: three-state semantics ────────────────────────────────────────
function TechThreeState() {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Three states: tier 0, a real tier, and missing</h3>
      <p className="mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        The dashboard distinguishes three states on purpose. <strong>Tier 0</strong> means we
        measured zero reach in a district whose child population we know.{' '}
        <strong>“Data unavailable”</strong> means we don’t have the inputs to compute a fair
        number for that district-year.
      </p>
      <div
        className="p-4"
        style={{
          background: 'var(--color-background-secondary)',
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
            <ThreeStateRow books="More than 0" demo="Yes" tier="1–5" meaning="Measured reach" />
            <ThreeStateRow books="Any" demo="No" tier={null} meaning="Cannot compute" />
          </tbody>
        </table>
      </div>
    </div>
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

// ── Tech: data sources detail ──────────────────────────────────────────
function TechDataSources() {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Data sources in detail</h3>
      <div
        className="p-4 overflow-x-auto"
        style={{
          background: 'var(--color-background-secondary)',
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
              coverage="2004 onwards, Connecticut only"
              updated="Annual CSV export from HUB, uploaded by the Data Director via /admin/upload. Each upload triggers point-in-polygon matching to a district and a tier recompute."
            />
            <DataRow
              source="CT State Dept. of Education (EdSight)"
              what="District-level enrollment + high-needs counts"
              coverage="2009 onwards, all 158 CT public school districts"
              updated="Annual .xlsx export from EdSight, uploaded via /admin/upload. Parser reads the “Total” and “High Needs” rows of the student_group column."
            />
            <DataRow
              source="U.S. Census ACS 5-Year (B01001 age × sex table)"
              what="Population aged 0–4 and 5–9 per district"
              coverage="2009 onwards; each year’s estimates released ~December for the prior 5-year window"
              updated="Server-side fetch from api.census.gov via /admin/census-refresh. When the current year’s estimates haven’t been published yet, the previous year’s estimates are carried forward and the row is flagged as a proxy (see decision H8)."
            />
            <DataRow
              source="U.S. Census TIGER/Line (composite of unsd + elsd)"
              what="School-district polygons used for matching distributions and rendering the map"
              coverage="158 CT districts; static within the platform"
              updated="Baked into the app at frontend/public/composite_simplified.geojson (simplified for the map) and backend/data/composite_unsd_elsd.geojson (full-resolution for the spatial join)."
            />
          </tbody>
        </table>
      </div>
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

// ── Tech: methodology decisions on record ──────────────────────────────
function TechDecisions() {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Methodology decisions on record</h3>
      <p className="mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Documented in the repo at <span className="font-mono">docs/ASSUMPTIONS.md</span> with full reasoning.
      </p>
      <DecisionCard
        id="G1+D2"
        title="Full cross-product panel: measured no-reach is real"
        rule="Every (district, year) cell exists, even when no books were distributed. A district with zero books and a known child population gets tier 0 (“measured no reach”) rather than being dropped from the panel."
        impact="The map now shows districts that genuinely received zero books as dark red, instead of hiding them. Overall and High-Needs views follow the same rule: zero books reach zero of anyone."
        implementation="backend/src/services/pipeline.js (zeroReach guard) + backend/scripts/expand-panel.js (one-shot backfill) + backend/scripts/recompute-zero-reach.js."
        accepted="2026-05-21"
      />
      <DecisionCard
        id="H8"
        title="Census estimates carry-forward"
        rule="When the current year’s U.S. Census estimates haven’t been published yet, the previous year’s population values are carried forward and the row is flagged."
        impact="The 2025 panel year is visible right now using the 2024 estimates. The small “Census 2024” label next to the year slider and inside the district header tells you which year’s estimates produced the number."
        implementation="backend/src/services/pipeline.js (applyProxyCensus), which runs after every /upload-books, /census-refresh, and config recompute. Refuses to carry forward more than one year."
        accepted="2026-05-21"
      />
    </div>
  )
}

function DecisionCard({ id, title, rule, impact, implementation, accepted }) {
  return (
    <div
      className="p-4 space-y-2 mb-3"
      style={{
        background: 'var(--color-background-secondary)',
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
      <p><strong>What changes for the dashboard.</strong> {impact}</p>
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Implementation: <span className="font-mono">{implementation}</span>
      </p>
    </div>
  )
}

// ── Full doc placeholder (unchanged) ───────────────────────────────────
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
