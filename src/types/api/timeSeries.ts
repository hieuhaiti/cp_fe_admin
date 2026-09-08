export type SatellitePlatform = 'sentinel-1' | 'sentinel-2' | 'landsat-7' | 'landsat-8' | string

export interface LayerLifecycleInfo {
  id: number | string
  code: string
  nameVi?: string
  publishStatus?: string | null
  cleanupStatus?: string | null
  deletedAt?: string | null
}

export interface SatelliteImageMember {
  id: number | string
  scene_code: string
  title: string
  platform: SatellitePlatform
  thematic_group?: string | null
  coverage_key: string
  acquired_at: string
  product_level?: string | null
  resolution_m?: number | string | null
  cloud_cover_percent?: number | string | null
  orbit_number?: number | null
  description?: string | null
  layer_id?: number | string | null
  standalone_layer_id?: number | string | null
  original_name?: string
  size_bytes?: number | string
  created_at: string
  updated_at: string
  standaloneLayer?: LayerLifecycleInfo | null
  timeSeriesLayer?: LayerLifecycleInfo | null
}

export interface SatelliteImageListData {
  items: SatelliteImageMember[]
}

export interface CollectionGroup {
  coverageKey: string
  thematicGroup?: string | null
  totalImages: number
  uniqueDates: number
  earliestAcquiredAt?: string | null
  latestAcquiredAt?: string | null
  hasDuplicateDates: boolean
  duplicateDateCount: number
  isPublishable: boolean
  collectionLayer?: LayerLifecycleInfo | null
}

export interface CollectionGroupListData {
  items: CollectionGroup[]
}

export interface TimeSeriesCatalogMember {
  imageId: number | string
  sceneCode: string
  acquiredAt: string
  fileObjectId: number | string
}

export interface TimeSeriesCatalog {
  enabled: true
  mode: 'discrete' | string
  coverageKey?: string | null
  defaultTime: string
  values: string[]
  members: TimeSeriesCatalogMember[]
}

/** DTO emitted by GET /web-map/time-series-layers for a published Time Series layer. */
export interface TimeSeriesCatalogLayer {
  id: number | string
  code: string
  nameVi: string
  category?: string | null
  categoryName?: string | null
  geometryType?: string | null
  storageKind?: string | null
  srid?: number | null
  geoserverLayer: string
  minZoom?: number | null
  maxZoom?: number | null
  isPublic?: boolean
  isEnableDefault?: boolean
  timeSeries: TimeSeriesCatalog
}

export interface CreateSatelliteImageRequest {
  sceneCode: string
  title: string
  platform: SatellitePlatform
  thematicGroup?: string | null
  coverageKey: string
  acquiredAt: string
  productLevel?: string | null
  resolutionM?: number
  cloudCoverPercent?: number
  orbitNumber?: number
  description?: string | null
  fileObjectId: number
}

export interface PublishCollectionRequest {
  code: string
  nameVi: string
  category: string
  srid: number
  minZoom?: number | null
  maxZoom?: number | null
  legendConfig?: Record<string, unknown>
  metadata?: Record<string, unknown>
  isPublic?: boolean
}

export interface PublishCollectionResponse {
  coverageKey: string
  layer: {
    id: number
    code: string
    name_vi?: string
    updatedAt?: string
    updated_at?: string
  }
  geoserverLayer: string
  imageIds: number[]
  fileObjectIds: number[]
  timeSeries: TimeSeriesCatalog
}
