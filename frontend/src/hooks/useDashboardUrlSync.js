import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDashboardStore } from '../store/dashboard.js'

// Bi-directional sync between the dashboard store and URL query params.
// - On mount: read URL → seed store.
// - On store change: write store → URL (replace, no history pollution).
// Counties serialize as a comma-separated list. selectedDistrictGeoid passes
// through unchanged. selectedYear is an integer; selectedMetric is the enum.
export function useDashboardUrlSync() {
  const [params, setParams] = useSearchParams()
  const hydrated = useRef(false)

  // ── Read URL → store (once) ────────────────────────────────────────────
  useEffect(() => {
    if (hydrated.current) return
    const next = {}
    const y = params.get('year')
    const m = params.get('metric')
    const a = params.get('age')
    const c = params.get('counties')
    const d = params.get('district')
    if (y) next.selectedYear = parseInt(y)
    if (m === 'overall' || m === 'hn') next.selectedMetric = m
    if (a === '0_4' || a === '0_9' || a === '5_9') next.selectedAge = a
    if (c) next.selectedCounties = c.split(',').filter(Boolean)
    if (d) next.selectedDistrictGeoid = d
    if (Object.keys(next).length) useDashboardStore.getState().hydrate(next)
    hydrated.current = true
  }, [params])

  // ── Store → URL ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = useDashboardStore.subscribe((s) => {
      if (!hydrated.current) return
      const next = new URLSearchParams()
      if (s.selectedYear != null)            next.set('year', String(s.selectedYear))
      if (s.selectedMetric && s.selectedMetric !== 'overall') next.set('metric', s.selectedMetric)
      if (s.selectedAge && s.selectedAge !== '0_9') next.set('age', s.selectedAge)
      if (s.selectedCounties.length)         next.set('counties', s.selectedCounties.join(','))
      if (s.selectedDistrictGeoid)           next.set('district', s.selectedDistrictGeoid)
      setParams(next, { replace: true })
    })
    return unsub
  }, [setParams])
}
