// Types cho forest-classification API. Mirror shape từ
// server/src/controllers/forest-classification.controller.js formatSnapshot()
// và services/forest-classification/pipeline.js buildLegend()/summariseCoverage().
//
// province_summary structure (từ pipeline):
//   - byClass: { [classId: 0..11]: haNumber }
//   - totalHa: number
//   - forestHa / forestPercent: rừng tự nhiên + rừng trồng (classes 1+2)
//   - mineHa / minePercent: khai trường mỏ + bãi thải mỏ (classes 9+10)
//   - legend: [{ classId, nameVi, nameEn, color, ha, percent }]
//   - classSchema: 'campha_landcover_12'

import type { GeeProcessingState } from './geeProcessing'

export interface ForestClassLegendEntry {
  classId: number
  nameVi: string
  nameEn: string
  color: string
  ha: number
  percent: number
}

export interface ForestClassProvinceSummary {
  byClass?: Record<string, number>
  totalHa?: number | null
  forestHa?: number
  forestPercent?: number
  mineHa?: number
  minePercent?: number
  legend?: ForestClassLegendEntry[]
  classSchema?: string
  source?: string
  rasterIngestJobId?: number | string | null
  [key: string]: unknown
}

export interface ForestClassSnapshot {
  id: number | string
  year: number
  month: number
  attempt?: number
  status: string // pending | computing | completed | failed | published
  provinceSummary?: ForestClassProvinceSummary
  oobAccuracy?: number | null
  testKappa?: number | null
  geoserverLayer?: string | null
  geeTileUrl?: string | null
  geeTileGeneratedAt?: string | null
  geeDownloadUrl?: string | null
  geoserverDownloadUrl?: string | null
  downloadFilename?: string | null
  computedAt?: string | null
  errorMessage?: string | null
  retryCount?: number
  nextRetryAt?: string | null
  lastRetryError?: string | null
  /** Ngưỡng % mây tối đa đã dùng khi chạy kỳ này (null = mặc định server). */
  cloudCover?: number | null
  modelParams?: Record<string, unknown>
  [key: string]: unknown
}

export interface ForestClassAreaComparisonMetric {
  currentHa: number
  previousHa: number
  deltaHa: number
  changePct: number | null
}

export interface ForestClassClassComparison extends ForestClassAreaComparisonMetric {
  classId: number
  className: string
}

export interface ForestClassComparison {
  previousSnapshot: {
    id: number | string
    year: number
    month: number
    computedAt?: string | null
    publishedAt?: string | null
  }
  province: {
    total: ForestClassAreaComparisonMetric
    forest: ForestClassAreaComparisonMetric
    classes: ForestClassClassComparison[]
  }
}

export interface ForestClassLatestData {
  snapshot: ForestClassSnapshot | null
  comparison?: ForestClassComparison | null
  geeTileUrl?: string | null
  stale?: boolean
  computing?: boolean
  processing?: GeeProcessingState
}

export interface ForestClassPublishRasterData {
  snapshotId: number | string
  jobId?: number | string
  status?: string
  layerCode?: string
  deduplicated?: boolean
  geoserverLayer?: string
  alreadyPublished?: boolean
}

// Row từ /history: server trả snake_case cho row DB nguyên bản.
export interface ForestClassHistoryItem {
  id: number | string
  year: number
  month: number
  attempt?: number
  status: string
  trigger?: string | null
  requested_by?: number | string | null
  oob_accuracy?: number | null
  test_accuracy?: number | null
  test_kappa?: number | null
  s2_image_count?: number | null
  ls_image_count?: number | null
  gt_zone_count?: number | null
  gt_point_count?: number | null
  duration_ms?: number | null
  download_scale_m?: number | null
  province_summary?: ForestClassProvinceSummary | null
  computed_at?: string | null
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  gee_tile_url?: string | null
  gee_tile_generated_at?: string | null
  gee_download_url?: string | null
  geoserver_layer?: string | null
  error_message?: string | null
  [key: string]: unknown
}

export interface ForestClassHistoryData {
  items: ForestClassHistoryItem[]
}

export interface ForestClassRefreshBody {
  year?: number
  month?: number
  groundTruthAssetId?: string
  gtBufferM?: number
  minFieldTest?: number
  /** Ngưỡng % mây tối đa cho ảnh Sentinel-2. 0–100. Server mặc định 50. */
  cloudCover?: number
}

export interface ForestClassRefreshData {
  run: {
    year: number
    month: number
    status: 'queued' | 'computing'
    deduplicated: boolean
    processing: GeeProcessingState
  }
}

export interface ForestClassHistoryParams {
  page?: number
  limit?: number
  hasGeoserverLayer?: boolean | string
}
