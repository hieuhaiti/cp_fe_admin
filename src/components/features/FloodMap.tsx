'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { buildBasemapStyle } from '@/lib/basemap'

export interface FloodMapLayer {
  /** Unique stable id used as MapLibre source/layer id prefix */
  id: string
  /** WMS tile URL built by buildGeoserverRasterTileUrl */
  tileUrl: string
  visible: boolean
  opacity?: number
}

const CAM_PHA_CENTER: [number, number] = [107.283749, 21.10361]
const CAM_PHA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [106.8337, 20.6536],
  [107.7337, 21.5536],
]

function applyLayers(
  map: maplibregl.Map,
  layers: FloodMapLayer[],
  addedIdsRef: React.MutableRefObject<string[]>,
) {
  for (const id of [...addedIdsRef.current].reverse()) {
    if (map.getLayer(`flood-layer-${id}`)) map.removeLayer(`flood-layer-${id}`)
    if (map.getSource(`flood-src-${id}`)) map.removeSource(`flood-src-${id}`)
  }
  addedIdsRef.current = []
  for (const layer of layers) {
    if (!layer.tileUrl) continue
    try {
      map.addSource(`flood-src-${layer.id}`, {
        type: 'raster',
        tiles: [layer.tileUrl],
        tileSize: 256,
      })
      map.addLayer({
        id: `flood-layer-${layer.id}`,
        type: 'raster',
        source: `flood-src-${layer.id}`,
        paint: { 'raster-opacity': layer.opacity ?? 0.8 },
        layout: { visibility: layer.visible ? 'visible' : 'none' },
      })
      addedIdsRef.current.push(layer.id)
    } catch {
      // skip duplicate or bad-state errors
    }
  }
}

/**
 * Multi-layer flood map preview.
 * Each FloodMapLayer maps to one MapLibre raster source + layer.
 * Toggling `visible` does NOT recreate sources (preserves tile cache).
 * Changing `layers` array identity (new run selected) tears down and rebuilds.
 *
 * Map init is deferred one tick via setTimeout so that dialog open animations
 * complete before WebGL context creation — prevents main-thread freezes.
 */
export default function FloodMap({
  layers,
  heightClassName = 'h-[22rem]',
}: {
  layers: FloodMapLayer[]
  heightClassName?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const addedIdsRef = useRef<string[]>([])
  // Stores the latest layers prop so the deferred init callback can use them
  // even if they changed before the map finished initializing.
  const pendingLayersRef = useRef<FloodMapLayer[]>(layers)
  // Tracks the last source layout (id+url) to skip teardown when only
  // visibility/opacity changed — prevents flickering on every toggle.
  const sourceKeyRef = useRef('')

  // Init map once, deferred so dialog animation completes first.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const container = containerRef.current
    let map: maplibregl.Map | null = null

    const tid = setTimeout(() => {
      if (!container || mapRef.current) return
      map = new maplibregl.Map({
        container,
        style: buildBasemapStyle().spec,
        center: CAM_PHA_CENTER,
        zoom: 11,
        maxBounds: CAM_PHA_MAX_BOUNDS,
        attributionControl: false,
      })
      mapRef.current = map

      // Apply any layers that arrived before map finished loading.
      const onLoad = () => applyLayers(map!, pendingLayersRef.current, addedIdsRef)
      if (map.isStyleLoaded()) onLoad()
      else map.once('load', onLoad)
    }, 16)

    return () => {
      clearTimeout(tid)
      map?.remove()
      if (mapRef.current === map) mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild sources/layers only when IDs or tile URLs change.
  // Visibility/opacity-only changes are handled by the effect below — this
  // prevents teardown + re-add on every toggle, which caused colour flickering.
  useEffect(() => {
    const key = layers.map((l) => `${l.id}\0${l.tileUrl}`).join('\n')
    pendingLayersRef.current = layers
    if (key === sourceKeyRef.current) return // sources unchanged, skip rebuild
    sourceKeyRef.current = key

    const map = mapRef.current
    if (!map) return

    const setup = () => applyLayers(map, layers, addedIdsRef)
    if (map.isStyleLoaded()) setup()
    else map.once('load', setup)
    return () => { map.off('load', setup) }
  }, [layers])

  // Visibility-only effect — no source teardown
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    for (const layer of layers) {
      const lid = `flood-layer-${layer.id}`
      if (!map.getLayer(lid)) continue
      map.setLayoutProperty(lid, 'visibility', layer.visible ? 'visible' : 'none')
      if (layer.opacity != null) map.setPaintProperty(lid, 'raster-opacity', layer.opacity)
    }
  }, [layers])

  return (
    <div className={`relative ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-md border" />
      {layers.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-amber-50/95 px-3 py-1 text-xs text-amber-800 shadow">
          Không có lớp bản đồ đã công bố cho lượt chạy này.
        </div>
      )}
    </div>
  )
}
