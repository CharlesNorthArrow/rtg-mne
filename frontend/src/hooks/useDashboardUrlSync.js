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
    const t = params.get('typologies')
    const d = params.get('district')
    const klo  = params.get('keiLowMin')
    const khi  = params.get('keiHighMin')
    const elo  = params.get('elaMin')
    const ehi  = params.get('elaMax')
    if (y) next.selectedYear = parseInt(y)
    if (m === 'overall' || m === 'hn') next.selectedMetric = m
    if (a === '0_4' || a === '0_9' || a === '5_9') next.selectedAge = a
    if (c) next.selectedCounties = c.split(',').filter(Boolean)
    if (t) next.selectedTypologies = t.split(',').filter(Boolean)
    if (d) next.selectedDistrictGeoid = d
    if (klo != null || khi != null || elo != null || ehi != null) {
      next.selectedOutcomeFilters = {
        keiLowMin:  klo != null ? Number(klo) : 0,
        keiHighMin: khi != null ? Number(khi) : 0,
        elaMin:     elo != null ? Number(elo) : null,
        elaMax:     ehi != null ? Number(ehi) : null,
      }
    }
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
      if (s.selectedTypologies.length)       next.set('typologies', s.selectedTypologies.join(','))
      if (s.selectedDistrictGeoid)           next.set('district', s.selectedDistrictGeoid)
      const o = s.selectedOutcomeFilters
      if (o) {
        if (o.keiLowMin  !== 0)    next.set('keiLowMin',  String(o.keiLowMin))
        if (o.keiHighMin !== 0)    next.set('keiHighMin', String(o.keiHighMin))
        if (o.elaMin     !== null) next.set('elaMin',     String(o.elaMin))
        if (o.elaMax     !== null) next.set('elaMax',     String(o.elaMax))
      }
      setParams(next, { replace: true })
    })
    return unsub
  }, [setParams])
}
