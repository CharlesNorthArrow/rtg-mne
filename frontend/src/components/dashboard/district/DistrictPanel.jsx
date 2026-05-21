import { useMemo } from 'react'
import {
  districtSeries,
  lifetimeRows,
  demographicsSeries,
} from '../../../lib/districtSelectors.js'
import { ratioFieldName } from '../../../lib/tiers.js'
import DistrictHeader from './DistrictHeader.jsx'
import LifetimeTiers from './LifetimeTiers.jsx'
import DemographicsContext from './DemographicsContext.jsx'

export default function DistrictPanel({
  panel,
  geoid,
  year,
  age,
  tierOf,
  ratioOf,
  onClose,
}) {
  const series = useMemo(() => districtSeries(panel, geoid), [panel, geoid])
  const lifetime = useMemo(() => lifetimeRows(series), [series])

  // Static lifetime total: sum of single-year books_combined across all years
  // (NOT the rolling 3-yr column, to avoid triple-counting).
  const lifetimeBooks = useMemo(
    () => series.reduce((s, r) => s + (r.books_combined || 0), 0),
    [series],
  )

  const ratioOverallField = ratioFieldName('overall', age)
  const ratioHnField      = ratioFieldName('hn',      age)
  const demographics = useMemo(
    () => demographicsSeries(series, ratioOverallField, ratioHnField),
    [series, ratioOverallField, ratioHnField],
  )

  // Current-year row, falling back to the most recent row if the district
  // has no entry for `year`. Header identity, tier, and ratio all read off
  // this single source.
  const currentRow = useMemo(
    () => series.find(r => r.year === year) ?? series[series.length - 1] ?? null,
    [series, year],
  )

  const tier  = currentRow ? tierOf(currentRow)  : null
  const ratio = currentRow ? ratioOf(currentRow) : null

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <DistrictHeader
        row={currentRow}
        tier={tier}
        ratio={ratio}
        lifetimeBooks={lifetimeBooks}
        onClose={onClose}
      />
      <LifetimeTiers
        lifetime={lifetime}
        tierOf={tierOf}
        selectedYear={year}
      />
      <DemographicsContext
        demographics={demographics}
        age={age}
        year={year}
      />
    </div>
  )
}
