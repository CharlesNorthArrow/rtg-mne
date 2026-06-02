import { create } from 'zustand'

// Identity-stable default for the need filter. Consumers can compare against
// this with === to short-circuit when no filter is applied.
export const NO_NEED_THRESHOLDS = Object.freeze({ econDis: 0, englishLearner: 0, swd: 0 })

// Outcome-slider defaults. KEI sliders are lower bounds (0 = no filter).
// ELA is a range filter with min/max bounds; null means "use elaRange.min /
// elaRange.max" — DashboardPage substitutes the computed data range, so null
// reads as "show all" without needing to know the data range at store-init.
export const NO_OUTCOME_FILTERS = Object.freeze({
  keiLowMin: 0,
  keiHighMin: 0,
  elaMin: null,
  elaMax: null,
})

// Dashboard state — single source of truth per spec §5.
// Selectors are computed by consumers (see lib/dashboardSelectors.js).
// Typology values come straight from the ArcGIS CT Town Typology layer's
// Group_ field. Treat as a closed set — the dropdown UI shows these four
// in this order. Empty selectedTypologies = no filter (same convention as
// selectedCounties).
export const TYPOLOGY_OPTIONS = Object.freeze([
  'Rural',
  'Suburban',
  'Urban Periphery',
  'Urban Core',
])

export const useDashboardStore = create((set) => ({
  selectedYear:             null,                  // populated from data on mount
  selectedMetric:           'overall',             // 'overall' | 'hn'
  selectedAge:              '0_9',                 // '0_4' | '0_9' | '5_9'
  selectedCounties:         [],                    // [] = all
  selectedTypologies:       [],                    // [] = all
  selectedDistrictGeoid:    null,                  // null = snapshot mode
  hoveredDistrictGeoid:     null,                  // map tooltip only
  selectedNeedThresholds:   NO_NEED_THRESHOLDS,    // { econDis, englishLearner, swd } as 0–100 pct floors
  selectedOutcomeFilters:   NO_OUTCOME_FILTERS,    // { keiLowMax, keiHighMin, elaMin }

  setYear:               (selectedYear)            => set({ selectedYear }),
  setMetric:             (selectedMetric)          => set({ selectedMetric }),
  setAge:                (selectedAge)             => set({ selectedAge }),
  setCounties:           (selectedCounties)        => set({ selectedCounties }),
  setTypologies:         (selectedTypologies)      => set({ selectedTypologies }),
  setSelectedDistrict:   (selectedDistrictGeoid)   => set({ selectedDistrictGeoid }),
  setHoveredDistrict:    (hoveredDistrictGeoid)    => set({ hoveredDistrictGeoid }),
  setNeedThresholds:     (selectedNeedThresholds)  => set({ selectedNeedThresholds }),
  resetNeedThresholds:   ()                         => set({ selectedNeedThresholds: NO_NEED_THRESHOLDS }),
  setOutcomeFilters:     (selectedOutcomeFilters)  => set({ selectedOutcomeFilters }),
  resetOutcomeFilters:   ()                         => set({ selectedOutcomeFilters: NO_OUTCOME_FILTERS }),

  // Hydrate from URL on mount
  hydrate: (partial) => set(partial),
}))

// Derived selectors — pass to useDashboardStore(selector) to subscribe to slices.
export const selectViewMode = (s) => s.selectedDistrictGeoid ? 'district' : 'snapshot'
export const selectTierField = (s) => s.selectedMetric === 'hn' ? 'tier_hn' : 'tier_overall'
export const selectRatioField = (s) => s.selectedMetric === 'hn' ? 'ratio_0_9_hn' : 'ratio_0_9'
