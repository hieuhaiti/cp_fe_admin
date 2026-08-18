export interface FloodOverviewBlock {
  runId: number | string
  module: string
  status: string
  monitorStart: string | null
  monitorEnd: string | null
  floodExtentAreaHa: number | null
  populationAffected: number | null
  cropAffectedAreaHa: number | null
  builtAffectedAreaHa: number | null
  /** Diện tích vùng nhạy cảm tiêu thoát — chỉ có khi model đã tính */
  drainageAlertAreaHa: number | null
  finishedAt: string | null
}

export interface ClassificationOverviewBlock {
  snapshotId: number | string
  year: number
  month: number
  status: string
  totalAreaHa: number | null
  finishedAt: string | null
}

export interface LandCompositionBlock {
  forestAreaHa: number | null
  mineAreaHa: number | null
  forestPercent: number | null
  minePercent: number | null
  totalAreaHa: number | null
}

export interface FeedbackOverviewBlock {
  total: number
  byStatus: Record<string, number>
}

export interface AdminDashboardOverview {
  flood: FloodOverviewBlock | null
  classification: ClassificationOverviewBlock | null
  landComposition: LandCompositionBlock | null
  feedback: FeedbackOverviewBlock
}
