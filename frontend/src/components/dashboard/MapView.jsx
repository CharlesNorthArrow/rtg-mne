import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { TIER_CONFIG, getTierColor } from '../../lib/tiers.js'

// TODO: swap OSM tiles for a managed tile provider (MapTiler, Carto) before production —
// OSM's tile.openstreetmap.org has a usage policy that doesn't allow heavy app traffic.
const BASE_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.45 } }],
}

const CT_CENTER = [-72.7, 41.55]
const CT_ZOOM   = 7.5

const NO_DATA_COLOR = TIER_CONFIG[null].mapColor

function featureBounds(features) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const visitRing = ring => {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lat < minLat) minLat = lat
      if (lon > maxLon) maxLon = lon
      if (lat > maxLat) maxLat = lat
    }
  }
  for (const f of features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') g.coordinates.forEach(visitRing)
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => poly.forEach(visitRing))
  }
  if (minLon === Infinity) return null
  return [[minLon, minLat], [maxLon, maxLat]]
}

export default function MapView({ districts, tierMode, selectedGeoid, onSelectDistrict, countyFiltered }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const geojsonRef   = useRef(null)
  const [styleReady, setStyleReady] = useState(false)
  const [hover, setHover] = useState(null) // { x, y, district } in screen coords

  const tierField = tierMode === 'hn' ? 'tier_hn' : 'tier_overall'
  const ratioField = tierMode === 'hn' ? 'ratio_0_9_hn' : 'ratio_0_9'

  // Build a geoid → district lookup so paint and tooltips don't iterate the array on every event
  const byGeoid = useMemo(() => {
    const m = new Map()
    for (const d of districts) m.set(d.school_district_geoid, d)
    return m
  }, [districts])

  // Initialize map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: CT_CENTER,
      zoom: CT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    map.on('load', async () => {
      try {
        const res = await fetch('/composite_unsd_elsd.geojson')
        if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`)
        const geojson = await res.json()
        geojsonRef.current = geojson

        map.addSource('districts', { type: 'geojson', data: geojson, promoteId: 'GEOID' })

        map.addLayer({
          id: 'districts-fill',
          type: 'fill',
          source: 'districts',
          paint: {
            'fill-color': NO_DATA_COLOR,
            'fill-opacity': 0.75,
          },
        })

        map.addLayer({
          id: 'districts-line',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': '#1F2937',
            'line-width': 0.4,
          },
        })

        map.addLayer({
          id: 'districts-selected',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': '#111827',
            'line-width': 3,
          },
          filter: ['==', ['get', 'GEOID'], '__none__'],
        })

        setStyleReady(true)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Map setup failed:', err)
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Repaint when districts or tier mode change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (byGeoid.size === 0) {
      map.setPaintProperty('districts-fill', 'fill-color', NO_DATA_COLOR)
      return
    }

    const stops = []
    for (const [geoid, d] of byGeoid) {
      stops.push(geoid, getTierColor(d[tierField]))
    }
    map.setPaintProperty('districts-fill', 'fill-color', [
      'match',
      ['get', 'GEOID'],
      ...stops,
      NO_DATA_COLOR,
    ])
  }, [byGeoid, tierField, styleReady])

  // Selected-district outline
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    map.setFilter('districts-selected', ['==', ['get', 'GEOID'], selectedGeoid || '__none__'])
  }, [selectedGeoid, styleReady])

  // Fit bounds to current selection: district > county filter > default CT view
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !geojsonRef.current) return

    let features = []
    if (selectedGeoid) {
      const f = geojsonRef.current.features.find(f => f.properties.GEOID === selectedGeoid)
      if (f) features = [f]
    } else if (countyFiltered) {
      features = geojsonRef.current.features.filter(f => byGeoid.has(f.properties.GEOID))
    }

    if (features.length === 0) {
      map.flyTo({ center: CT_CENTER, zoom: CT_ZOOM, duration: 700, essential: true })
      return
    }
    const b = featureBounds(features)
    if (!b) return
    map.fitBounds(b, { padding: 60, duration: 700, maxZoom: 11, essential: true })
  }, [selectedGeoid, countyFiltered, byGeoid, styleReady])

  // Hover + click
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    function onMove(e) {
      const f = e.features?.[0]
      if (!f) { setHover(null); map.getCanvas().style.cursor = ''; return }
      const geoid = f.properties.GEOID
      const d = byGeoid.get(geoid)
      const name = d?.school_district_name || f.properties.NAME || geoid
      map.getCanvas().style.cursor = 'pointer'
      setHover({
        x: e.point.x,
        y: e.point.y,
        name,
        district: d || null,
      })
    }
    function onLeave() {
      setHover(null)
      map.getCanvas().style.cursor = ''
    }
    function onClick(e) {
      const f = e.features?.[0]
      if (!f) return
      onSelectDistrict(f.properties.GEOID)
    }

    map.on('mousemove', 'districts-fill', onMove)
    map.on('mouseleave', 'districts-fill', onLeave)
    map.on('click', 'districts-fill', onClick)
    return () => {
      map.off('mousemove', 'districts-fill', onMove)
      map.off('mouseleave', 'districts-fill', onLeave)
      map.off('click', 'districts-fill', onClick)
    }
  }, [byGeoid, onSelectDistrict, styleReady])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div ref={containerRef} className="absolute inset-0" />
      <Legend tierMode={tierMode} />
      {hover && <Tooltip {...hover} tierMode={tierMode} />}
    </div>
  )
}

const SD_TYPE_LABEL = {
  unsd: 'Unified School District',
  elsd: 'Elementary School District',
}

const fmtInt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-US')
const fmtBpc = n => (n == null || isNaN(n)) ? '—' : n.toFixed(3)
const fmtPct = n => (n == null || isNaN(n)) ? '—' : `${Math.round(n * 100)}%`

function Tooltip({ x, y, name, district, tierMode }) {
  const tier  = district ? (tierMode === 'hn' ? district.tier_hn : district.tier_overall) : null
  const cfg   = TIER_CONFIG[tier] ?? TIER_CONFIG[null]
  const hnActive = tierMode === 'hn'

  return (
    <div
      className="pointer-events-none absolute z-20 w-[280px] rounded-lg border border-gray-200 bg-white text-xs shadow-xl"
      style={{ left: x + 12, top: y + 12 }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-sm font-semibold text-gray-900 leading-tight">{name}</div>
        {district && (
          <div className="mt-0.5 text-[11px] text-gray-500">
            {[
              SD_TYPE_LABEL[district.sd_type] || district.sd_type,
              district.county,
              district.year,
            ].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Tier chip */}
      <div className="px-3">
        <div
          className="rounded-md px-2.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide"
          style={{ background: cfg.mapColor, color: cfg.textColor }}
        >
          Tier {tier ?? '—'} · {cfg.label}
        </div>
      </div>

      {/* Stats */}
      {district ? (
        <div className="mt-2 px-3 pb-3 space-y-1.5">
          <Row
            label="Books per child"
            sublabel="3-year avg, ages 0–9"
            value={fmtBpc(district.ratio_0_9)}
            emphasis={!hnActive}
          />
          <Row
            label="Books per high-needs child"
            value={fmtBpc(district.ratio_0_9_hn)}
            emphasis={hnActive}
          />
          <div className="border-t border-gray-100 pt-1.5 space-y-1.5">
            <Row label="Books distributed (3-yr avg)" value={fmtInt(district.rolling_3yr_combined)} />
            <Row label="Children ages 0–9"           value={fmtInt(district.census_pop_0_9)} />
            <Row label="High-needs students"          value={fmtPct(district.doe_high_needs_pct)} />
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 text-gray-500">
          No data for this district in the selected year.
        </div>
      )}
    </div>
  )
}

function Row({ label, sublabel, value, emphasis }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className={emphasis ? 'text-gray-900 font-medium' : 'text-gray-700'}>{label}</div>
        {sublabel && <div className="text-[10px] text-gray-400">{sublabel}</div>}
      </div>
      <div className={`font-mono tabular-nums ${emphasis ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
        {value}
      </div>
    </div>
  )
}

function Legend({ tierMode }) {
  const tiers = [0, 1, 2, 3, 4, 5]
  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-md border border-gray-200 bg-white/95 p-3 text-xs shadow-sm">
      <div className="mb-1 font-medium text-gray-700">
        {tierMode === 'hn' ? 'High-Needs tier' : 'Overall tier'}
      </div>
      <div className="space-y-1">
        {tiers.map(t => (
          <div key={t} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-gray-300"
              style={{ background: TIER_CONFIG[t].mapColor }}
            />
            <span className="text-gray-700">{t} — {TIER_CONFIG[t].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-gray-200"
            style={{ background: TIER_CONFIG[null].mapColor }}
          />
          <span className="text-gray-700">No data</span>
        </div>
      </div>
    </div>
  )
}
