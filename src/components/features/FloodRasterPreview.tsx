import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { buildBasemapStyle } from '@/lib/basemap'
import { buildMapProxyRasterTileUrl } from '@/lib/geoserver'

interface FloodRasterPreviewProps {
  layerId: number | string
  isPublic?: boolean
}

const SOURCE_ID = 'flood-preview-raster'
const LAYER_ID = 'flood-preview-raster-layer'
const CAM_PHA_CENTER: [number, number] = [107.303749, 21.002361]

export default function FloodRasterPreview({ layerId, isPublic = false }: FloodRasterPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [tileUrl, setTileUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    buildMapProxyRasterTileUrl(layerId, isPublic)
      .then((url) => {
        if (!cancelled) setTileUrl(url)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Không tạo được URL xem bản đồ.')
      })

    return () => {
      cancelled = true
    }
  }, [isPublic, layerId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle().spec,
      center: CAM_PHA_CENTER,
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !tileUrl) return
    let failed = false

    const handleSourceData = (event: maplibregl.MapSourceDataEvent) => {
      if (!failed && event.sourceId === SOURCE_ID && event.isSourceLoaded) setStatus('ready')
    }
    const handleError = (event: maplibregl.ErrorEvent) => {
      if (!('sourceId' in event) || event.sourceId !== SOURCE_ID) return
      failed = true
      setStatus('error')
      setErrorMessage('Dịch vụ bản đồ không trả được ảnh preview cho lớp này.')
    }
    const setup = () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      map.addSource(SOURCE_ID, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: 'Dữ liệu phân tích ngập lụt Cẩm Phả',
      })
      map.addLayer({
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: { 'raster-opacity': 0.78 },
      })
    }

    map.on('sourcedata', handleSourceData)
    map.on('error', handleError)
    if (map.isStyleLoaded()) setup()
    else map.once('load', setup)

    return () => {
      map.off('load', setup)
      map.off('sourcedata', handleSourceData)
      map.off('error', handleError)
    }
  }, [tileUrl])

  return (
    <div className="relative h-96">
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-md border" />
      {status === 'loading' ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-sky-50/95 px-3 py-1 text-xs text-sky-800 shadow">
          Đang tải lớp ngập lụt...
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 mx-auto w-fit max-w-[90%] rounded-md bg-red-50/95 px-3 py-1 text-xs text-red-700 shadow">
          {errorMessage || 'Không tải được dữ liệu bản đồ.'}
        </div>
      ) : null}
    </div>
  )
}
