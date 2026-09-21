export type GeometryTypePostman =
  | 'POINT'
  | 'MULTIPOINT'
  | 'LINESTRING'
  | 'MULTILINESTRING'
  | 'POLYGON'
  | 'MULTIPOLYGON'
  | 'GEOMETRY'
  | 'RASTER'

/** Legacy lowercase alias */
export type GeometryType = 'point' | 'line' | 'polygon' | GeometryTypePostman

export type LayerKind = 'basemap' | 'overlay'
export type SourceFormat = 'shapefile' | 'geojson' | 'kml' | 'geotiff' | 'filegdb'
export type ImportMode = 'overwrite' | 'append'
export type ImportJobStatus =
  | 'queued'
  | 'running'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface MapLayerLegendEntry {
  label: string
  color: string
}

export interface MapLayerLegend {
  entries: MapLayerLegendEntry[]
}

export interface MapLayerDefaultStyle {
  // Polygon
  fillColor?: string
  fillOpacity?: number
  fillAntialias?: boolean
  // Line & Polygon stroke
  strokeColor?: string
  strokeOpacity?: number
  strokeWidth?: number
  strokeBlur?: number
  strokeOffset?: number
  strokeDasharray?: number[] | null
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'bevel' | 'round' | 'miter'
  // Point
  circleColor?: string
  circleOpacity?: number
  circleRadius?: number
  circleBlur?: number
  circleStrokeColor?: string
  circleStrokeOpacity?: number
  circleStrokeWidth?: number
  // Raster
  rasterOpacity?: number
  brightnessMin?: number
  brightnessMax?: number
  contrast?: number
  saturation?: number
  hueRotate?: number
  fadeDuration?: number
  resampling?: 'linear' | 'nearest'
  // Common
  opacity?: number
  visible_by_default?: boolean
  [key: string]: unknown
}

export interface MapLayer {
  id?: number | string
  code: string
  name_vi?: string | null
  name_en?: string | null
  description_vi?: string | null
  description_en?: string | null
  table_name?: string | null
  schema_name?: string | null
  geometry_column?: string | null
  geometry_type?: GeometryType | null
  epsg_code?: number | null
  srid?: number | null
  storage_kind?: string | null
  object_key?: string | null
  style_name?: string | null
  legend_config?: MapLayerLegend | null

  metadata?: (Record<string, unknown> & { defaultStyle?: MapLayerDefaultStyle | null }) | null
  source_file_id?: number | string | null
  publish_status?: string | null
  cleanup_status?: string | null
  version?: number | null
  deleted_at?: string | null
  geoserver_layer?: string | null
  geoserver_store?: string | null
  source_url?: string | null
  default_style?: MapLayerDefaultStyle | null
  min_zoom?: number | null
  max_zoom?: number | null
  label_field?: string | null
  category?: string | null
  category_name?: string | null
  layer_kind?: LayerKind | null
  data_year?: number | null
  source_dataset?: string | null
  source_layer_name?: string | null
  is_active?: boolean
  is_public?: boolean
  is_enable_default?: boolean
  is_editable?: boolean
  is_published?: boolean
  sort_order?: number | null
  layer_permissions?: Record<string, unknown> | null
  remote_sensing_image_id?: number | string | null
  feature_count?: number | string | null
  bbox?: GeoJSON.Geometry | null
  last_updated_at?: string | null
  workspace?: string | null
  createdAt?: string | null
  updatedAt?: string | null

  name?: string
  geometry_data?: object | string
  properties?: Record<string, unknown>
  is_lost_forest?: boolean
  created_by?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface MapLayerListData {
  items?: MapLayer[]
  mapLayers: MapLayer[]
  pagination?: import('./index').Pagination
}

export interface MapLayerListParams {
  category?: string
  layer_kind?: LayerKind
  data_year?: number
  geometry_type?: string
  geometryType?: string
  is_active?: boolean
  is_public?: boolean
  isPublic?: boolean
  publish_data?: boolean

  page?: number
  limit?: number
  q?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface CreateMapLayerBody {
  code: string
  name_vi: string
  name_en?: string
  table_name: string
  schema_name?: string
  geometry_type: GeometryType
  epsg_code?: number
  category?: string
  category_name?: string | null
  layer_kind?: LayerKind
  is_active?: boolean
  is_public?: boolean
  is_enable_default?: boolean
  is_editable?: boolean
  legend_config?: MapLayerLegend | null
  metadata?: Record<string, unknown> | null
  expectedUpdatedAt?: string

  name?: string
  geometry_data?: object | string
  properties?: Record<string, unknown>
}

export interface PatchMapLayerBody {
  nameVi?: string
  name_vi?: string
  name_en?: string | null
  is_public?: boolean
  isPublic?: boolean
  category?: string
  category_name?: string | null
  categoryName?: string | null
  style_name?: string | null
  styleName?: string | null
  min_zoom?: number | null
  minZoom?: number | null
  max_zoom?: number | null
  maxZoom?: number | null
  legend_config?: MapLayerLegend | null
  legendConfig?: MapLayerLegend | null
  metadata?: Record<string, unknown> | null
  is_enable_default?: boolean
  isEnableDefault?: boolean
  expectedUpdatedAt?: string
  data_year?: number | null
  sort_order?: number
}

export interface PatchMapLayerActiveBody {
  is_active: boolean
}

export interface ImportGeoJsonInlineBody {
  source_format: 'geojson'
  import_mode: ImportMode
  auto_publish?: boolean
  geojson: {
    type: 'FeatureCollection'
    features: GeoJSON.Feature[]
  }
}

export interface ImportJob {
  id: number
  job_id?: string
  import_type?: string
  file_object_id?: number
  layer_id?: number
  layer_code?: string
  source_format?: SourceFormat
  status: ImportJobStatus
  progress?: number
  attempt?: number
  max_attempts?: number
  feature_count?: number
  geometry_type?: string
  source_srid?: number
  target_srid?: number
  error_code?: string
  error_message?: string
  started_at?: string
  finished_at?: string
  created_at?: string
  updated_at?: string
  publish_status?: string
  geoserver_layer?: string
  createdAt?: string
  updatedAt?: string
}

export interface ImportJobError {
  id: number
  job_id: number
  source_row: number | null
  error_code: string
  error_message: string
  raw_data?: Record<string, unknown> | null
  created_at?: string
}

export interface ShapefileImportPayload {
  fileObjectId: number | string
  code: string
  nameVi: string
  category: string
  targetSrid: number
  isPublic: boolean
  sourceEncoding?: string
  topologyProfile?: 'basic' | 'administrative_boundary'
}

export interface HarvestRasterBody {
  tif_path: string
  geoserver_layer?: string
  truncate_cache?: boolean
}

export interface CalculateLostAreaBody {
  points: Array<{ latitude: number; longitude: number }>
  auto_close_polygon?: boolean
}

export interface CalculateLostAreaResult {
  area_m2: number
  area_ha: number
  perimeter_m?: number
}

export interface LayerCleanupJob {
  id: number | string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string
  attempt: number
  maxAttempts: number
  nextAttemptAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface LayerCleanupStatus {
  layerId: number | string
  code: string
  deletedAt?: string | null
  cleanupStatus: 'none' | 'queued' | 'running' | 'complete' | 'failed' | string
  updatedAt?: string | null
  canRetry: boolean
  job?: LayerCleanupJob | null
}

