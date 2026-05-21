import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { TIER_CONFIG, getTierColor } from '../../lib/tiers.js'
import { fmtBpc, fmtInt, SD_TYPE_LABEL } from '../../lib/format.js'
import Legend from './Legend.jsx'

// Neutral, no-labels raster basemap. Carto's "light_nolabels" is essentially
// land/water + minor roads in pale grey — no place names, no transit, no
// strong colour. Free for use under their attribution requirement.
const BASE_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.75 } }],
}

const HIGHLIGHT_COLOR = '#243A78' // RTG brand blue

const CT_CENTER = [-72.7, 41.55]
const CT_ZOOM   = 7.7

const NO_DATA_COLOR = '#E5E7EB' // light grey on the map; the Legend shows the striped pattern

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

export default function MapView({
  panelByYear,
  year,
  tierMode,
  tierOf,           // (row) => tier number | null
  ratioOf,          // (row) => ratio | null
  visibleGeoids,    // Set<geoid> | 'all'
  selectedGeoid,
  onSelectDistrict,
  countyFiltered,
}) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const geojsonRef   = useRef(null)
  const [styleReady, setStyleReady] = useState(false)
  const [hover, setHover] = useState(null) // { x, y, geoid }

  // Year's data, keyed by geoid
  const byGeoid = useMemo(() => {
    const m = new Map()
    for (const r of (panelByYear.get(year) || [])) m.set(r.school_district_geoid, r)
    return m
  }, [panelByYear, year])

  // Initialize map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: CT_CENTER,
      zoom: CT_ZOOM,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('load', async () => {
      try {
        const res = await fetch('/composite_simplified.geojson')
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
            'fill-opacity': 0.78,
          },
        })

        map.addLayer({
          id: 'districts-line',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 0.6,
            'line-opacity': 0.85,
          },
        })

        map.addLayer({
          id: 'districts-selected',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': HIGHLIGHT_COLOR,
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

  // Repaint when the data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (byGeoid.size === 0) {
      map.setPaintProperty('districts-fill', 'fill-color', NO_DATA_COLOR)
      return
    }

    // Build a match expression: geoid → tier color
    const stops = []
    for (const [geoid, d] of byGeoid) {
      const t = tierOf(d)
      stops.push(geoid, t == null ? NO_DATA_COLOR : getTierColor(t))
    }
    map.setPaintProperty('districts-fill', 'fill-color', [
      'match', ['get', 'GEOID'], ...stops, NO_DATA_COLOR,
    ])
  }, [byGeoid, tierOf, styleReady])

  // Selection outline
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    map.setFilter('districts-selected', ['==', ['get', 'GEOID'], selectedGeoid || '__none__'])
  }, [selectedGeoid, styleReady])

  // Dim non-focused districts (county filter) AND highlight selected
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    let opacityExpr = 0.78
    if (selectedGeoid) {
      opacityExpr = ['case',
        ['==', ['get', 'GEOID'], selectedGeoid], 0.92,
        0.35,
      ]
    } else if (countyFiltered && visibleGeoids !== 'all') {
      const arr = [...visibleGeoids]
      opacityExpr = ['case',
        ['in', ['get', 'GEOID'], ['literal', arr]], 0.85,
        0.12,
      ]
    }
    map.setPaintProperty('districts-fill', 'fill-opacity', opacityExpr)
  }, [selectedGeoid, countyFiltered, visibleGeoids, styleReady])

  // Fit bounds when selection / county filter changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !geojsonRef.current) return

    let features = []
    if (selectedGeoid) {
      const f = geojsonRef.current.features.find(f => f.properties.GEOID === selectedGeoid)
      if (f) features = [f]
    } else if (countyFiltered && visibleGeoids !== 'all') {
      features = geojsonRef.current.features.filter(f => visibleGeoids.has(f.properties.GEOID))
    }

    if (features.length === 0) {
      map.flyTo({ center: CT_CENTER, zoom: CT_ZOOM, duration: 700, essential: true })
      return
    }
    const b = featureBounds(features)
    if (!b) return
    map.fitBounds(b, { padding: 60, duration: 700, maxZoom: 11, essential: true })
  }, [selectedGeoid, countyFiltered, visibleGeoids, styleReady])

  // Hover + click
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    function onMove(e) {
      const f = e.features?.[0]
      if (!f) { setHover(null); map.getCanvas().style.cursor = ''; return }
      map.getCanvas().style.cursor = 'pointer'
      setHover({ x: e.point.x, y: e.point.y, geoid: f.properties.GEOID })
    }
    function onLeave() { setHover(null); map.getCanvas().style.cursor = '' }
    function onClick(e) {
      const f = e.features?.[0]
      if (!f) return
      const g = f.properties.GEOID
      onSelectDistrict(selectedGeoid === g ? null : g)
    }

    map.on('mousemove', 'districts-fill', onMove)
    map.on('mouseleave', 'districts-fill', onLeave)
    map.on('click', 'districts-fill', onClick)
    return () => {
      map.off('mousemove', 'districts-fill', onMove)
      map.off('mouseleave', 'districts-fill', onLeave)
      map.off('click', 'districts-fill', onClick)
    }
  }, [styleReady, onSelectDistrict, selectedGeoid])

  const hoveredDistrict = hover ? byGeoid.get(hover.geoid) : null

  return (
    <div
      className="relative h-full w-full flex flex-col"
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '0.5px solid var(--color-border-tertiary)',
        padding: 12,
      }}
    >
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Reach by district, {year ?? '—'}
          {countyFiltered && visibleGeoids !== 'all' && (
            <span className="ml-1.5 font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
              · {visibleGeoids.size} districts
            </span>
          )}
        </h2>
        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {tierMode === 'hn' ? 'High-Needs' : 'Overall'}
        </span>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0" />

      {hover && hoveredDistrict && (
        <Tooltip x={hover.x} y={hover.y} d={hoveredDistrict} tierOf={tierOf} ratioOf={ratioOf} />
      )}

      <Legend tierMode={tierMode} />
    </div>
  )
}

function Tooltip({ x, y, d, tierOf, ratioOf }) {
  const tier = tierOf(d)
  const cfg  = TIER_CONFIG[tier] ?? TIER_CONFIG[null]
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 rounded-md border text-xs shadow-lg"
      style={{
        left: x + 12,
        top: y + 12,
        background: 'var(--color-background-primary)',
        borderColor: 'var(--color-border-secondary)',
      }}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {d.school_district_name}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {[SD_TYPE_LABEL[d.sd_type] || d.sd_type, d.county].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="px-3 pb-3">
        <div
          className="rounded px-2 py-1 text-center text-[11px] font-semibold"
          style={{
            background: cfg.mapColor === 'transparent' ? 'var(--color-background-secondary)' : cfg.mapColor,
            color: cfg.textColor,
            border: tier === 0 ? '1px solid var(--color-border-secondary)' : 'none',
          }}
        >
          {tier == null ? 'No data' : `Tier ${tier} · ${cfg.label}`}
        </div>
        <div className="mt-2 space-y-0.5 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          <Row label="Books per child"  value={fmtBpc(ratioOf(d))} />
          <Row label="Books (3-yr avg)" value={fmtInt(d.rolling_3yr_combined)} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}
