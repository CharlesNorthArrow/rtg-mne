import { create } from 'zustand'

// Dashboard state — single source of truth per spec §5.
// Selectors are computed by consumers (see lib/dashboardSelectors.js).
export const useDashboardStore = create((set) => ({
  selectedYear:          null,          // populated from data on mount
  selectedMetric:        'overall',     // 'overall' | 'hn'
  selectedAge:           '0_9',         // '0_4' | '0_9' | '5_9'
  selectedCounties:      [],            // [] = all
  selectedDistrictGeoid: null,          // null = snapshot mode
  hoveredDistrictGeoid:  null,          // map tooltip only

  setYear:              (selectedYear)          => set({ selectedYear }),
  setMetric:            (selectedMetric)        => set({ selectedMetric }),
  setAge:               (selectedAge)           => set({ selectedAge }),
  setCounties:          (selectedCounties)      => set({ selectedCounties }),
  setSelectedDistrict:  (selectedDistrictGeoid) => set({ selectedDistrictGeoid }),
  setHoveredDistrict:   (hoveredDistrictGeoid)  => set({ hoveredDistrictGeoid }),

  // Hydrate from URL on mount
  hydrate: (partial) => set(partial),
}))

// Derived selectors — pass to useDashboardStore(selector) to subscribe to slices.
export const selectViewMode = (s) => s.selectedDistrictGeoid ? 'district' : 'snapshot'
export const selectTierField = (s) => s.selectedMetric === 'hn' ? 'tier_hn' : 'tier_overall'
export const selectRatioField = (s) => s.selectedMetric === 'hn' ? 'ratio_0_9_hn' : 'ratio_0_9'
