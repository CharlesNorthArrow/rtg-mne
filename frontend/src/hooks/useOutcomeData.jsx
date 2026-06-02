import { createContext, useContext, useEffect, useState } from 'react'
import {
  ELA_URL, KEI_URL, TYPOLOGY_URL, ELA_WHERE,
  fetchAllPages, fetchPage, shapeEla, shapeKei, shapeTypology,
} from './outcomeData.core.js'

const OutcomeDataContext = createContext(null)

export function OutcomeDataProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    keiByGeoidYear: null,
    elaByGeoidYear: null,
    typologyByGeoid: null,
    unresolvedTypology: [],
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Load the same GeoJSON the map uses so the typology lookup keys match.
        const geoJsonRes = await fetch('/composite_simplified.geojson')
        if (!geoJsonRes.ok) throw new Error(`GeoJSON ${geoJsonRes.status} ${geoJsonRes.statusText}`)
        const geoJson = await geoJsonRes.json()
        const districts = geoJson.features.map(f => f.properties)

        const [elaRows, keiRows, typologyJson] = await Promise.all([
          fetchAllPages(ELA_URL, ELA_WHERE,
            'GEOID,Year_start,Student_Group,Category,ELAPerformanceIndex'),
          fetchAllPages(KEI_URL, '1=1',
            'GEOID,School_Year___Start,LI_PCT1,LI_PCT3'),
          fetchPage(TYPOLOGY_URL, {
            where: '1=1',
            outFields: 'TOWN,Group_',
            returnGeometry: 'false',
            f: 'json',
          }),
        ])

        const typologyRows = (typologyJson.features || []).map(f => f.attributes)
        const { typologyByGeoid, unresolved } = shapeTypology(typologyRows, districts)

        if (cancelled) return
        setState({
          loading: false,
          error: null,
          keiByGeoidYear:     shapeKei(keiRows),
          elaByGeoidYear:     shapeEla(elaRows),
          typologyByGeoid,
          unresolvedTypology: unresolved,
        })
      } catch (err) {
        if (cancelled) return
        setState(s => ({ ...s, loading: false, error: err.message || String(err) }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <OutcomeDataContext.Provider value={state}>
      {children}
    </OutcomeDataContext.Provider>
  )
}

export function useOutcomeData() {
  const ctx = useContext(OutcomeDataContext)
  if (!ctx) throw new Error('useOutcomeData must be used inside <OutcomeDataProvider>')
  return ctx
}
