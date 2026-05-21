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

  // Current-year row (or null if district has no row for selected year)
  const currentRow = useMemo(
    () => series.find(r => r.year === year) ?? series[series.length - 1] ?? null,
    [series, year],
  )

  // Fallback row for header identity (name, county, type, geoid) if currentRow null
  const idRow = currentRow ?? series[series.length - 1] ?? null

  const tier  = currentRow ? tierOf(currentRow)  : null
  const ratio = currentRow ? ratioOf(currentRow) : null

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <DistrictHeader
        row={idRow ? { ...idRow, rolling_3yr_combined: currentRow?.rolling_3yr_combined } : null}
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
