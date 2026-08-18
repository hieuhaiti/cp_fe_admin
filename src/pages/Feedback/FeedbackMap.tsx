import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import { buildBasemapStyle } from '@/lib/basemap'
import { citizenFeedbackService, useApiQuery } from '@/service'
import type { ApiResponse, FeedbackFeatureCollection } from '@/types/api'

// Props kept compatible with parent (index.tsx) — data/isLoading/isError from parent are ignored;
// this component self-fetches from the list API so markers always reflect real report locations.
interface FeedbackMapProps {
  data?: FeedbackFeatureCollection | null
  isLoading?: boolean
  isError?: boolean
  onSelect: (id: number | string) => void
}

const SOURCE_ID = 'feedback-source'
const LAYER_ID = 'feedback-points'

// Status → color mapping using real API status values
// (pending, under_review, approved, resolved, rejected)
const STATUS_PAINT_EXPR = [
  'match',
  ['get', 'status'],
  'pending', '#f59e0b',
  'under_review', '#3b82f6',
  'approved', '#22c55e',
  'resolved', '#16a34a',
  'rejected', '#ef4444',
  '#64748b',
] as maplibregl.ExpressionSpecification

interface LocalFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string | number; status: string }
}

interface LocalFC {
  type: 'FeatureCollection'
  features: LocalFeature[]
}

function getBounds(fc: LocalFC): LngLatBoundsLike | null {
  const coords = fc.features
    .map((f) => f.geometry.coordinates)
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))

  if (!coords.length) return null

  const bounds = coords.reduce(
    (b, [lng, lat]) => ({
      minLng: Math.min(b.minLng, lng),
      minLat: Math.min(b.minLat, lat),
      maxLng: Math.max(b.maxLng, lng),
      maxLat: Math.max(b.maxLat, lat),
    }),
    { minLng: coords[0][0], minLat: coords[0][1], maxLng: coords[0][0], maxLat: coords[0][1] }
  )

  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ]
}

export default function FeedbackMap({ onSelect }: FeedbackMapProps) {
  const listQuery = useApiQuery(
    ['feedback-map-list'],
    () => citizenFeedbackService.getAll({ limit: 100 }),
    {},
    false,
    false
  )

  const geoJson: LocalFC = useMemo(() => {
    const rawItems: any[] =
      ((listQuery.data as ApiResponse<any> | undefined)?.data as any)?.items ?? []
    const features: LocalFeature[] = rawItems
      .filter(
        (item) =>
          Number.isFinite(item.longitude) &&
          Number.isFinite(item.latitude) &&
          item.longitude !== 0 &&
          item.latitude !== 0
      )
      .map((item) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.longitude as number, item.latitude as number],
        },
        properties: { id: item.id, status: item.status ?? 'pending' },
      }))
    return { type: 'FeatureCollection', features }
  }, [listQuery.data])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  const geoJsonRef = useRef(geoJson)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    geoJsonRef.current = geoJson
  }, [geoJson])

  // Map initialization — runs once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle().spec,
      center: [107.283749, 21.10361],
      zoom: 11,
      maxBounds: [[106.8337, 20.6536], [107.7337, 21.5536]],
    })


    map.on('load', () => {
      const data = geoJsonRef.current
      map.addSource(SOURCE_ID, { type: 'geojson', data: data as any })
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': STATUS_PAINT_EXPR,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 13, 12],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9,
        },
      })

      map.on('mouseenter', LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', LAYER_ID, (event) => {
        const id = event.features?.[0]?.properties?.id
        if (id !== undefined && id !== null) onSelectRef.current(id)
      })

      const bounds = getBounds(data)
      if (bounds) map.fitBounds(bounds, { padding: 56, duration: 300, maxZoom: 14 })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update source data when geoJson changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(geoJson as any)

    if (geoJson.features.length > 0) {
      const bounds = getBounds(geoJson)
      if (bounds) map.fitBounds(bounds, { padding: 56, duration: 300, maxZoom: 14 })
    }
  }, [geoJson])

  const isLoading = listQuery.isLoading || listQuery.isFetching
  const isError = listQuery.isError
  const isEmpty = !isLoading && !isError && geoJson.features.length === 0

  return (
    <div className="relative h-[min(68vh,680px)] min-h-96 w-full overflow-hidden rounded-md border">
      <div ref={containerRef} className="size-full" aria-label="Bản đồ phản ánh hiện trường" />

      {/* Status legend */}
      {!isLoading && !isError && !isEmpty && (
        <div className="bg-background/90 absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-md border p-2 text-xs">
          {[
            { color: '#f59e0b', label: 'Mới tiếp nhận' },
            { color: '#3b82f6', label: 'Đang xử lý' },
            { color: '#22c55e', label: 'Đã phê duyệt' },
            { color: '#16a34a', label: 'Đã xử lý' },
            { color: '#ef4444', label: 'Từ chối' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
              {label}
            </div>
          ))}
        </div>
      )}

      {(isLoading || isError || isEmpty) && (
        <div className="bg-background/90 absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm">
          {isLoading
            ? 'Đang tải điểm phản ánh...'
            : isError
              ? 'Không thể tải bản đồ phản ánh.'
              : 'Không có điểm phản ánh phù hợp bộ lọc.'}
        </div>
      )}
    </div>
  )
}
