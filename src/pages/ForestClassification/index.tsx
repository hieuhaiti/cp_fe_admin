import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import {
  Download,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  RefreshCcw,
  RotateCcw,
  TreePine,
  Upload,
  Mountain,
  Layers,
  Percent,
} from 'lucide-react'
import { forestClassificationService, useApiMutation, useApiQuery } from '@/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDateTime } from '@/lib/date'
import {
  buildGeoserverDownloadUrl,
  buildGeoserverPreviewUrl,
  buildGeoserverRasterTileUrl,
  getUsableTemporaryRasterUrl,
} from '@/lib/geoserver'
import type {
  ApiResponse,
  ForestClassHistoryData,
  ForestClassHistoryItem,
  ForestClassLatestData,
  ForestClassLegendEntry,
  ForestClassProvinceSummary,
  ForestClassPublishRasterData,
  ForestClassRefreshData,
  ForestClassSnapshot,
} from '@/types/api'
import ForestMap from '@/components/features/ForestMap'
import LoadingInline from '@/components/common/LoadingInline'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import ForestGroundTruthCard from './ForestGroundTruthCard'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

/**
 * Forest Classification (Cẩm Phả) — admin
 *
 * Toàn TP Cẩm Phả tính chung một polygon; không còn tách theo huyện.
 * KPI: tổng diện tích, diện tích rừng + %, diện tích mỏ + %.
 * Legend đến từ server (`provinceSummary.legend`) với đủ classId/nameVi/color/ha/percent.
 */

const ANALYSIS_POLL_INTERVAL_MS = 20_000
const LIVE_STATUSES = new Set(['pending', 'computing', 'exporting'])
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  computing: 'Đang tính toán',
  exporting: 'Đang xuất bản đồ',
  completed: 'Hoàn tất',
  published: 'Đã công bố',
  failed: 'Thất bại',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  computing: 'bg-sky-100 text-sky-800 border-sky-200',
  exporting: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
}

/** 8-class object taxonomy calibrated for Cẩm Phả terrain/vegetation (2026). */
const FOREST_CLASS_DEFINITIONS = [
  { classId: 0, nameVi: 'Mặt nước', nameEn: 'Water surface', color: '#1A73E8' },
  {
    classId: 1,
    nameVi: 'Rừng lá rộng thường xanh (thưa)',
    nameEn: 'Sparse evergreen broadleaf forest',
    color: '#2D7B2E',
  },
  { classId: 2, nameVi: 'Dân cư đô thị', nameEn: 'Urban / built-up', color: '#E91E63' },
  { classId: 3, nameVi: 'Đất trống khô', nameEn: 'Dry bare land', color: '#C8B097' },
  { classId: 4, nameVi: 'Bãi khai thác than', nameEn: 'Coal mining area', color: '#1A1A1A' },
  { classId: 5, nameVi: 'Cây bụi', nameEn: 'Shrubland', color: '#85C946' },
  { classId: 6, nameVi: 'Đất trống trảng cỏ', nameEn: 'Grassland / bare grass', color: '#BFD760' },
  { classId: 7, nameVi: 'Đất nông nghiệp', nameEn: 'Agricultural land', color: '#F5E642' },
] as const

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeSummary(
  source: ForestClassProvinceSummary | null | undefined
): ForestClassProvinceSummary | undefined {
  if (!source) return undefined
  const byClass = source.byClass ?? {}
  const classHa = (classId: number) => finiteNumber(byClass[String(classId)]) ?? 0
  const classTotal = FOREST_CLASS_DEFINITIONS.reduce(
    (sum, definition) => sum + classHa(definition.classId),
    0
  )
  const totalHa = finiteNumber(source.totalHa) ?? classTotal
  const forestHa = finiteNumber(source.forestHa) ?? classHa(1)
  const mineHa = finiteNumber(source.mineHa) ?? classHa(4)
  const percentOfTotal = (ha: number) => (totalHa > 0 ? (ha / totalHa) * 100 : 0)
  const legend =
    source.legend && source.legend.length > 0
      ? source.legend
      : FOREST_CLASS_DEFINITIONS.map((definition) => {
          const ha = classHa(definition.classId)
          return { ...definition, ha, percent: percentOfTotal(ha) }
        })

  return {
    ...source,
    byClass,
    totalHa,
    forestHa,
    forestPercent: finiteNumber(source.forestPercent) ?? percentOfTotal(forestHa),
    mineHa,
    minePercent: finiteNumber(source.minePercent) ?? percentOfTotal(mineHa),
    legend,
  }
}

const formatHa = (value: number | null | undefined) =>
  value == null || Number.isNaN(Number(value))
    ? '—'
    : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`

const formatPercent = (value: number | null | undefined) =>
  value == null || Number.isNaN(Number(value))
    ? '—'
    : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} %`

const getSeasonName = (month: number): string => {
  if (month <= 3) return 'Xuân'
  if (month <= 6) return 'Hạ'
  if (month <= 9) return 'Thu'
  return 'Đông'
}

const getSeasonRepresentativeMonth = (month: number): number => {
  if (month <= 3) return 3
  if (month <= 6) return 6
  if (month <= 9) return 9
  return 12
}

const getSeasonMonthRange = (representativeMonth: number): string => {
  if (representativeMonth === 3) return 'T1–3'
  if (representativeMonth === 6) return 'T4–6'
  if (representativeMonth === 9) return 'T7–9'
  return 'T10–12'
}

const formatPeriod = (year: number, month: number) => `${getSeasonName(month)} ${year}`

const latestCompletedYearMonth = () => {
  const now = new Date()
  const latestCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return {
    year: latestCompletedMonth.getFullYear(),
    month: latestCompletedMonth.getMonth() + 1,
  }
}

const validPeriod = (year: number, month: number) => {
  const latestCompleted = latestCompletedYearMonth()
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 1984 &&
    month >= 1 &&
    month <= 12 &&
    (year < latestCompleted.year ||
      (year === latestCompleted.year && month <= latestCompleted.month))
  )
}

const selectableSeasonsForYear = (year: number) => {
  if (!Number.isInteger(year) || year < 1984) return []
  const latestCompleted = latestCompletedYearMonth()
  // Use raw completed month (not the season rep) so the current in-progress
  // season is excluded until all its calendar months have elapsed.
  const ceiling =
    year < latestCompleted.year ? 12 : year === latestCompleted.year ? latestCompleted.month : 0
  return [3, 6, 9, 12].filter((m) => m <= ceiling)
}

function resolveRasterTileUrl(snapshot: ForestClassSnapshot | null): string | null {
  if (!snapshot) return null
  const geoserverTile = buildGeoserverRasterTileUrl(snapshot.geoserverLayer)
  if (geoserverTile) return geoserverTile
  const legacyTile = getUsableTemporaryRasterUrl(
    snapshot.geeTileUrl,
    snapshot.geeTileGeneratedAt ?? null
  )
  return legacyTile
}

export default function ForestClassificationPage() {
  const user = useAuthStore((state) => state.user)
  const canManage = hasPerm(user, 'forest_classification', 'manage')
  const canPublish = hasPerm(user, 'map_layers', 'ingest_raster')

  const queryClient = useQueryClient()
  const mapSectionRef = useRef<HTMLDivElement | null>(null)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  const [refreshPeriod, setRefreshPeriod] = useState(latestCompletedYearMonth)
  const [refreshCloudCover, setRefreshCloudCover] = useState<number>(50)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const latestQuery = useApiQuery<ApiResponse<ForestClassLatestData>>(
    ['forest-classification', 'latest'],
    () => forestClassificationService.getLatest(),
    {},
    false
  )
  const historyQuery = useApiQuery<ApiResponse<ForestClassHistoryData>>(
    ['forest-classification', 'history', page, pageSize],
    () => forestClassificationService.getHistory({ page, limit: pageSize }),
    { enabled: canManage },
    false
  )
  const selectedSnapshotQuery = useApiQuery<ApiResponse<ForestClassLatestData>>(
    ['forest-classification', 'snapshot', selectedSnapshotId],
    () => forestClassificationService.getSnapshot(selectedSnapshotId!),
    { enabled: selectedSnapshotId !== null },
    false
  )
  const refreshMutation = useApiMutation<
    ApiResponse<ForestClassRefreshData>,
    { year: number; month: number; cloudCover?: number }
  >((body) => forestClassificationService.refresh(body), {}, false)
  const publishMutation = useApiMutation<
    ApiResponse<ForestClassPublishRasterData>,
    number | string
  >((id) => forestClassificationService.publishSnapshotRaster(id, false), {}, false)

  const latest = latestQuery.data?.data
  const latestSnapshot = (latest?.snapshot || null) as ForestClassSnapshot | null
  const selectedSnapshot = (selectedSnapshotQuery.data?.data?.snapshot ||
    null) as ForestClassSnapshot | null
  const snapshot = selectedSnapshotId !== null ? selectedSnapshot || latestSnapshot : latestSnapshot
  const activeStatus = Boolean(latestSnapshot?.status && LIVE_STATUSES.has(latestSnapshot.status))
  useEffect(() => {
    if (!activeStatus) return
    const timer = setInterval(() => {
      latestQuery.refetch()
      historyQuery.refetch()
    }, ANALYSIS_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
    // Query objects are intentionally excluded so polling is keyed only by pipeline state.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  }, [activeStatus])

  // Toast async pipeline failure once per snapshot id.
  const failedIdRef = useRef<string | number | null>(null)
  useEffect(() => {
    if (!latestSnapshot || latestSnapshot.status !== 'failed') return
    if (failedIdRef.current === latestSnapshot.id) return
    failedIdRef.current = latestSnapshot.id
    const reason = latestSnapshot.errorMessage
    toast.error(
      reason
        ? `Kỳ ${formatPeriod(latestSnapshot.year, latestSnapshot.month)} phân loại thất bại: ${reason}`
        : `Kỳ ${formatPeriod(latestSnapshot.year, latestSnapshot.month)} phân loại thất bại.`,
      { autoClose: 10_000 }
    )
  }, [latestSnapshot])

  const summary = useMemo(
    () => normalizeSummary(snapshot?.provinceSummary),
    [snapshot?.provinceSummary]
  )
  const legend: ForestClassLegendEntry[] = useMemo(() => summary?.legend ?? [], [summary?.legend])
  const rasterTileUrl = useMemo(() => resolveRasterTileUrl(snapshot), [snapshot])
  const historyItems: ForestClassHistoryItem[] = historyQuery.data?.data?.items ?? []
  const historyTotal = Number(
    historyQuery.data?.metadata?.total ??
      (historyQuery.data?.data as { total?: number } | undefined)?.total ??
      0
  )

  const openRefresh = (period = latestCompletedYearMonth()) => {
    let year = period.year
    let month = getSeasonRepresentativeMonth(period.month)
    const available = selectableSeasonsForYear(year)
    if (!available.includes(month)) {
      // Season not yet complete — snap to the most recent valid one
      if (available.length > 0) {
        month = available[available.length - 1]
      } else {
        year -= 1
        month = 12
      }
    }
    setRefreshPeriod({ year, month })
    // Seed cloudCover from the currently selected snapshot if it has one,
    // otherwise use the server default (50%).
    const seed = snapshot?.cloudCover
    setRefreshCloudCover(Number.isFinite(Number(seed)) && Number(seed) > 0 ? Number(seed) : 50)
    setRefreshDialogOpen(true)
  }
  const refreshPeriodIsValid = validPeriod(refreshPeriod.year, refreshPeriod.month)
  const refreshSeasonOptions = useMemo(
    () => selectableSeasonsForYear(refreshPeriod.year),
    [refreshPeriod.year]
  )
  const confirmRefresh = () => {
    if (!validPeriod(refreshPeriod.year, refreshPeriod.month)) {
      toast.error('Kỳ phân tích không hợp lệ.')
      return
    }
    if (!Number.isFinite(refreshCloudCover) || refreshCloudCover < 0 || refreshCloudCover > 100) {
      toast.error('Ngưỡng mây phải từ 0 đến 100.')
      return
    }
    refreshMutation.mutate(
      { ...refreshPeriod, cloudCover: refreshCloudCover },
      {
        onSuccess: (response) => {
          const run = response?.data?.run
          toast.success(
            run?.deduplicated
              ? 'Kỳ này đã có trong hàng chờ.'
              : `Đã tiếp nhận yêu cầu phân loại ${formatPeriod(refreshPeriod.year, refreshPeriod.month)}.`
          )
          setRefreshDialogOpen(false)
          setSelectedSnapshotId(null)
          setPage(1)
          queryClient.invalidateQueries({ queryKey: ['forest-classification'] })
        },
        onError: (error) => {
          if (!error?.body?.message) toast.error('Không thể chạy phân loại. Vui lòng thử lại.')
        },
      }
    )
  }

  const publishSnapshot = (snapshotId: number | string) => {
    publishMutation.mutate(snapshotId, {
      onSuccess: (response) => {
        const message = response?.message || 'Đã tiếp nhận yêu cầu công bố kết quả.'
        toast.success(message)
        queryClient.invalidateQueries({ queryKey: ['forest-classification'] })
      },
      onError: (error) => {
        const codes: string[] = Array.isArray(error?.body?.errors) ? error.body.errors : []
        // Backend refuses publish when the Earth Engine download URL has aged
        // past its ~1h TTL — surfaces as GEE_DOWNLOAD_URL_STALE. Offer to
        // re-run the analysis instead of leaving the user with a raw 400.
        if (codes.includes('GEE_DOWNLOAD_URL_STALE')) {
          toast.error(
            error.body?.message ||
              'Bản đồ tạm từ vệ tinh đã hết hạn. Hãy bấm "Chạy lại phân tích" để tạo bản đồ mới.',
            { autoClose: 8000 }
          )
          setRefreshDialogOpen(true)
          return
        }
        if (!error?.body?.message) toast.error('Không thể công bố. Vui lòng thử lại.')
      },
    })
  }

  const onPublish = () => {
    if (snapshot) publishSnapshot(snapshot.id)
  }

  const openHistoryOnMap = (item: ForestClassHistoryItem) => {
    setSelectedSnapshotId(item.id)
    window.setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <TreePine className="size-6 text-emerald-600" /> Phân loại đối tượng · TP Cẩm Phả
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Kết quả phân loại 8 đối tượng.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              latestQuery.refetch()
              historyQuery.refetch()
            }}
            disabled={latestQuery.isFetching}
          >
            <RefreshCcw className={latestQuery.isFetching ? 'animate-spin' : ''} /> Làm mới
          </Button>
          {canManage && (
            <Button onClick={() => openRefresh()} disabled={refreshMutation.isPending}>
              {refreshMutation.isPending ? <Loader2 className="animate-spin" /> : <TreePine />}
              Chạy lại phân tích
            </Button>
          )}
        </div>
      </header>

      {latestQuery.isLoading ? (
        <LoadingInline />
      ) : !snapshot ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center">
            Chưa có kết quả phân loại nào. Bấm "Chạy lại phân tích" để tạo kỳ mới.
          </CardContent>
        </Card>
      ) : (
        <>
          <SnapshotOverview
            snapshot={snapshot}
            onPublish={canPublish ? onPublish : undefined}
            publishing={publishMutation.isPending}
          />
          <KpiCards summary={summary} />
          {selectedSnapshotId !== null && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <div className="flex items-center gap-2">
                <MapIcon className="size-4" />
                <span>
                  Đang xem kỳ lịch sử{' '}
                  <strong>
                    {snapshot
                      ? formatPeriod(snapshot.year, snapshot.month)
                      : `#${selectedSnapshotId}`}
                  </strong>
                  {selectedSnapshotQuery.isFetching && ' · Đang tải dữ liệu...'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedSnapshotId(null)}
              >
                Về kỳ mới nhất
              </Button>
            </div>
          )}
          <div ref={mapSectionRef} className="grid scroll-mt-6 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Bản đồ phân loại</CardTitle>
                <CardDescription>
                  {rasterTileUrl
                    ? snapshot.geoserverLayer
                      ? 'Bản đồ đã lưu trữ ổn định'
                      : 'Bản đồ tạm thời (có hiệu lực khoảng 1 giờ)'
                    : 'Chưa có bản đồ khả dụng — chờ hệ thống chuẩn bị hoặc chạy lại.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ForestMap
                  rasterTileUrl={rasterTileUrl}
                  legend={legendForMap(legend)}
                  heightClassName="h-[24rem] sm:h-[32rem]"
                />
              </CardContent>
            </Card>
            <LegendCard legend={legend} totalHa={summary?.totalHa ?? null} />
          </div>
          {canManage && (
            <HistoryCard
              items={historyItems}
              total={historyTotal}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              loading={historyQuery.isFetching}
              canManage={canManage}
              canPublish={canPublish}
              selectedSnapshotId={selectedSnapshotId}
              refreshing={refreshMutation.isPending}
              publishingId={publishMutation.isPending ? publishMutation.variables : null}
              onRerun={(item) => openRefresh({ year: item.year, month: item.month })}
              onPublish={(item) => publishSnapshot(item.id)}
              onOpenMap={openHistoryOnMap}
            />
          )}
          {canManage && <ForestGroundTruthCard />}
        </>
      )}

      <AlertDialog open={refreshDialogOpen} onOpenChange={setRefreshDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chạy lại phân loại đối tượng</AlertDialogTitle>
            <AlertDialogDescription>Chọn kỳ phân tích theo mùa</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <RecentSeasonsPicker
              seasons={buildRecentSeasons(historyItems)}
              value={refreshPeriod}
              onPick={(next) => setRefreshPeriod(next)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="refresh-year">Năm</Label>
                <Input
                  id="refresh-year"
                  type="number"
                  min={1984}
                  max={latestCompletedYearMonth().year}
                  value={refreshPeriod.year}
                  onChange={(e) => {
                    const year = Number(e.target.value)
                    const selectableSeasons = selectableSeasonsForYear(year)
                    setRefreshPeriod((prev) => ({
                      year,
                      month: selectableSeasons.includes(prev.month)
                        ? prev.month
                        : (selectableSeasons[selectableSeasons.length - 1] ?? prev.month),
                    }))
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="refresh-season">Mùa</Label>
                <Select
                  value={String(refreshPeriod.month)}
                  onValueChange={(next) =>
                    setRefreshPeriod((prev) => ({ ...prev, month: Number(next) }))
                  }
                >
                  <SelectTrigger id="refresh-season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {refreshSeasonOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {getSeasonName(m)}{' '}
                        <span className="text-muted-foreground text-xs">
                          ({getSeasonMonthRange(m)})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="refresh-cloud-cover">Ngưỡng mây tối đa ({refreshCloudCover}%)</Label>
              <Input
                id="refresh-cloud-cover"
                type="number"
                min={0}
                max={100}
                step={5}
                value={refreshCloudCover}
                onChange={(e) => setRefreshCloudCover(Number(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">
                Loại các ảnh Sentinel-2 có độ che phủ mây vượt ngưỡng này. Ngưỡng cao (70–90%) cho
                mùa mưa để có đủ ảnh; ngưỡng thấp (20–40%) cho mùa khô để tăng độ sạch. Mặc định
                50%.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refreshMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRefresh}
              disabled={refreshMutation.isPending || !refreshPeriodIsValid}
            >
              {refreshMutation.isPending ? <Loader2 className="animate-spin" /> : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Build the last 12 completed calendar months (newest first). Each entry tags the
 * status of the freshest snapshot for that period so the picker can hint
 * "đã có, chạy lại" vs "chưa có".
 */
function buildRecentSeasons(history: ForestClassHistoryItem[]) {
  const byKey = new Map<string, ForestClassHistoryItem>()
  for (const item of history) {
    const key = `${item.year}-${getSeasonRepresentativeMonth(item.month)}`
    if (!byKey.has(key)) byKey.set(key, item)
  }
  const latestCompleted = latestCompletedYearMonth()
  const latestSeason = getSeasonRepresentativeMonth(latestCompleted.month)
  const seasons: Array<{ year: number; month: number; status?: string; exists: boolean }> = []
  let year = latestCompleted.year
  let seasonMonth = latestSeason
  for (let i = 0; i < 8; i += 1) {
    const key = `${year}-${seasonMonth}`
    const existing = byKey.get(key)
    seasons.push({ year, month: seasonMonth, status: existing?.status, exists: Boolean(existing) })
    seasonMonth -= 3
    if (seasonMonth < 3) {
      seasonMonth = 12
      year -= 1
    }
  }
  return seasons
}

function RecentSeasonsPicker({
  seasons,
  value,
  onPick,
}: {
  seasons: ReturnType<typeof buildRecentSeasons>
  value: { year: number; month: number }
  onPick: (next: { year: number; month: number }) => void
}) {
  return (
    <div className="space-y-1">
      <Label>8 kỳ gần đây</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {seasons.map((s) => {
          const isSelected = s.year === value.year && s.month === value.month
          const isSelectable = validPeriod(s.year, s.month)
          return (
            <button
              key={`${s.year}-${s.month}`}
              type="button"
              disabled={!isSelectable}
              onClick={() => isSelectable && onPick({ year: s.year, month: s.month })}
              title={
                isSelectable
                  ? `${getSeasonName(s.month)} ${s.year} · ${getSeasonMonthRange(s.month)}`
                  : `${getSeasonName(s.month)} ${s.year} chưa kết thúc (${getSeasonMonthRange(s.month)})`
              }
              className={
                'rounded-md border p-1.5 text-xs transition ' +
                (isSelectable
                  ? isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 hover:border-slate-400'
                  : 'cursor-not-allowed border-slate-100 opacity-40')
              }
            >
              <div className="font-medium">
                {getSeasonName(s.month)} {s.year}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {!isSelectable ? (
                  <span className="text-slate-400">Chưa kết thúc</span>
                ) : s.exists ? (
                  <span className={STATUS_TONE[s.status || ''] || 'text-slate-500'}>
                    {STATUS_LABEL[s.status || ''] || s.status}
                  </span>
                ) : (
                  'Chưa có'
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function legendForMap(legend: ForestClassLegendEntry[]) {
  return legend.map((entry) => ({
    classId: entry.classId,
    name: entry.nameVi,
    color: entry.color,
  }))
}

function SnapshotOverview({
  snapshot,
  onPublish,
  publishing,
}: {
  snapshot: ForestClassSnapshot
  onPublish?: () => void
  publishing?: boolean
}) {
  const previewUrl = snapshot.geoserverLayer
    ? buildGeoserverPreviewUrl(snapshot.geoserverLayer)
    : null
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className={STATUS_TONE[snapshot.status] || ''}>
              {STATUS_LABEL[snapshot.status] || snapshot.status}
            </Badge>
            <span className="text-lg font-semibold">
              Kỳ {formatPeriod(snapshot.year, snapshot.month)}
            </span>
            {snapshot.computedAt && (
              <span className="text-muted-foreground text-sm">
                Cập nhật: {formatDateTime(snapshot.computedAt)}
              </span>
            )}
            {snapshot.attempt && snapshot.attempt > 1 && (
              <Badge variant="outline">Lần thử #{snapshot.attempt}</Badge>
            )}
            {snapshot.oobAccuracy != null && (
              <Badge variant="outline">OOB {(snapshot.oobAccuracy * 100).toFixed(1)}%</Badge>
            )}
            {snapshot.testKappa != null && (
              <Badge variant="outline">Kappa {snapshot.testKappa.toFixed(2)}</Badge>
            )}
            {snapshot.cloudCover != null && (
              <Badge variant="outline">Ngưỡng mây {snapshot.cloudCover}%</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink /> Mở bản đồ chi tiết
                </Button>
              </a>
            )}
            {snapshot.geoserverLayer ? (
              (() => {
                const geoserverDownload = buildGeoserverDownloadUrl(snapshot.geoserverLayer)
                return geoserverDownload ? (
                  <a href={geoserverDownload} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      <Download /> Tải ảnh phân loại
                    </Button>
                  </a>
                ) : null
              })()
            ) : snapshot.geeDownloadUrl ? (
              // GEE URL is bound to a token that expires ~1h after generation.
              // Only show it while there is no published GeoServer alternative.
              <a href={snapshot.geeDownloadUrl} target="_blank" rel="noreferrer">
                <Button
                  size="sm"
                  variant="outline"
                  tooltip="Ảnh tạm từ vệ tinh, có hiệu lực khoảng 1 giờ. Sau khi hệ thống lưu trữ xong sẽ có ảnh ổn định."
                >
                  <Download /> Tải ảnh (tạm ~1 giờ)
                </Button>
              </a>
            ) : null}
            {onPublish && ['completed', 'published'].includes(snapshot.status) && (
              <Button size="sm" onClick={onPublish} disabled={publishing}>
                {publishing ? <Loader2 className="animate-spin" /> : 'Công bố lên bản đồ'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCards({ summary }: { summary: ForestClassSnapshot['provinceSummary'] | undefined }) {
  const forestHa = finiteNumber(summary?.forestHa)
  const mineHa = finiteNumber(summary?.mineHa)
  const forestMineTotal = (forestHa ?? 0) + (mineHa ?? 0)
  const cards: Array<{
    icon: ReactNode
    label: string
    value: string
    hint?: string
    tone: string
  }> = [
    {
      icon: <Layers className="size-5" />,
      label: 'Tổng diện tích phân loại',
      value: formatHa(summary?.totalHa ?? null),
      tone: 'bg-slate-50',
    },
    {
      icon: <TreePine className="size-5 text-emerald-600" />,
      label: 'Diện tích rừng',
      value: formatHa(summary?.forestHa ?? null),
      hint: `Tỷ lệ ${formatPercent(summary?.forestPercent ?? null)} · Rừng lá rộng thường xanh (thưa)`,
      tone: 'bg-emerald-50',
    },
    {
      icon: <Mountain className="size-5 text-slate-700" />,
      label: 'Diện tích khu mỏ',
      value: formatHa(summary?.mineHa ?? null),
      hint: `Tỷ lệ ${formatPercent(summary?.minePercent ?? null)} · Bãi khai thác than`,
      tone: 'bg-stone-50',
    },
    {
      icon: <Percent className="size-5 text-sky-700" />,
      label: 'Rừng / (Rừng + Mỏ)',
      value:
        forestHa != null && mineHa != null && forestMineTotal > 0
          ? formatPercent((forestHa / forestMineTotal) * 100)
          : '—',
      hint: 'Tỷ lệ giữa 2 nhóm ưu tiên theo dõi',
      tone: 'bg-sky-50',
    },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className={card.tone}>
          <CardContent className="p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase">
              {card.icon}
              <span>{card.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold">{card.value}</div>
            {card.hint && <div className="text-muted-foreground mt-1 text-xs">{card.hint}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function LegendCard({
  legend,
  totalHa,
}: {
  legend: ForestClassLegendEntry[]
  totalHa: number | null | undefined
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bảng chú giải 8 đối tượng</CardTitle>
        <CardDescription>Diện tích và tỷ lệ từng đối tượng phân loại.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border [&>div]:max-h-[24rem] [&>div]:overflow-x-hidden [&>div]:overflow-y-auto sm:[&>div]:max-h-[32rem]">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-8 px-2 sm:px-4"></TableHead>
                <TableHead className="px-2 sm:px-4">Lớp</TableHead>
                <TableHead className="w-24 px-2 text-right sm:w-32 sm:px-4">Diện tích</TableHead>
                <TableHead className="w-16 px-2 text-right sm:w-24 sm:px-4">Tỷ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legend.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center text-sm">
                    Chưa có dữ liệu chú giải.
                  </TableCell>
                </TableRow>
              )}
              {legend.map((entry) => (
                <TableRow key={entry.classId}>
                  <TableCell className="px-2 sm:px-4">
                    <span
                      className="inline-block size-4 rounded border"
                      style={{ backgroundColor: entry.color }}
                    />
                  </TableCell>
                  <TableCell className="min-w-0 px-2 sm:px-4">
                    <div className="font-medium break-words">{entry.nameVi}</div>
                  </TableCell>
                  <TableCell className="px-2 text-right sm:px-4">{formatHa(entry.ha)}</TableCell>
                  <TableCell className="px-2 text-right sm:px-4">
                    {formatPercent(entry.percent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalHa != null && (
          <div className="text-muted-foreground mt-3 text-right text-xs">
            Tổng: <span className="font-medium">{formatHa(totalHa)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryCard({
  items,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  canManage,
  canPublish,
  selectedSnapshotId,
  refreshing,
  publishingId,
  onRerun,
  onPublish,
  onOpenMap,
}: {
  items: ForestClassHistoryItem[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  loading: boolean
  canManage: boolean
  canPublish: boolean
  selectedSnapshotId: number | string | null
  refreshing: boolean
  publishingId: number | string | null
  onRerun: (item: ForestClassHistoryItem) => void
  onPublish: (item: ForestClassHistoryItem) => void
  onOpenMap: (item: ForestClassHistoryItem) => void
}) {
  const [expandedId, setExpandedId] = useState<number | string | null>(null)
  const totalPages = Math.max(1, Math.ceil(Math.max(total, items.length) / pageSize))

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Lịch sử phân loại</CardTitle>
          <CardDescription>
            Mỗi kỳ chỉ hiển thị lần chạy gần nhất, sắp xếp theo thời gian giảm dần.
          </CardDescription>
        </div>
        {loading && <Loader2 className="text-muted-foreground size-5 animate-spin" />}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Kỳ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Diện tích rừng</TableHead>
                <TableHead className="text-right">Diện tích mỏ</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="min-w-56 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center text-sm">
                    Chưa có kỳ nào.
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => {
                const summary = normalizeSummary(item.province_summary)
                const expanded = expandedId === item.id
                const selected = selectedSnapshotId === item.id
                const isLive = LIVE_STATUSES.has(item.status)
                const isPublished = Boolean(item.geoserver_layer)
                const canPublishItem = ['completed', 'published'].includes(item.status)
                const isPublishing = publishingId === item.id

                return (
                  <Fragment key={item.id}>
                    <TableRow
                      className={`cursor-pointer ${selected ? 'bg-sky-50 hover:bg-sky-100' : ''}`}
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                    >
                      <TableCell>
                        <ChevronDown
                          className={`text-muted-foreground size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatPeriod(item.year, item.month)}</div>
                        <div className="text-muted-foreground text-xs">
                          Lần thử #{item.attempt ?? 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_TONE[item.status] || ''}>
                          {STATUS_LABEL[item.status] || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHa(summary?.forestHa ?? null)}
                        <div className="text-muted-foreground text-xs">
                          {formatPercent(summary?.forestPercent ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHa(summary?.mineHa ?? null)}
                        <div className="text-muted-foreground text-xs">
                          {formatPercent(summary?.minePercent ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.computed_at
                          ? formatDateTime(item.computed_at)
                          : item.updated_at
                            ? formatDateTime(item.updated_at)
                            : '—'}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant={selected ? 'default' : 'outline'}
                            onClick={() => onOpenMap(item)}
                          >
                            <MapIcon /> {selected ? 'Đang xem' : 'Mở bản đồ'}
                          </Button>
                          {canManage && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isLive || refreshing}
                              onClick={() => onRerun(item)}
                              tooltip={isLive ? 'Kỳ này đang được xử lý' : 'Chạy lại kỳ này'}
                            >
                              {refreshing ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                            </Button>
                          )}
                          {canPublish && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canPublishItem || isPublished || isPublishing}
                              onClick={() => onPublish(item)}
                              tooltip={
                                isPublished
                                  ? 'Kết quả đã công bố lên bản đồ'
                                  : 'Công bố lại kết quả mới nhất của kỳ'
                              }
                            >
                              {isPublishing ? <Loader2 className="animate-spin" /> : <Upload />}
                              {isPublished ? 'Đã công bố' : 'Công bố'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="p-0">
                          <HistoryDetails item={item} summary={summary} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-sm">
            {total > 0
              ? `${total.toLocaleString('vi-VN')} kỳ · Trang ${page}/${totalPages}`
              : 'Chưa có dữ liệu'}
          </div>
          {totalPages > 1 && (
            <PaginationCustom
              currentPage={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryDetails({
  item,
  summary,
}: {
  item: ForestClassHistoryItem
  summary: ForestClassProvinceSummary | undefined
}) {
  const previewUrl = item.geoserver_layer ? buildGeoserverPreviewUrl(item.geoserver_layer) : null
  const geoserverDownloadUrl = item.geoserver_layer
    ? buildGeoserverDownloadUrl(item.geoserver_layer)
    : null
  // Đường ống hiện tại là RULE-BASED (bộ luật Sentinel-2 tất định), không huấn
  // luyện mô hình ML — nên không có Kappa/OOB/accuracy hay ground-truth. Cột
  // ls_image_count/gee_task_id/... cũng không dùng vì đã bỏ Landsat và GEE
  // batch Export. Chỉ hiển thị các trường thực sự có dữ liệu để bảng gọn hơn.
  const cloudCover = (
    item as { cloud_cover?: number | null; model_params?: { cloudCover?: number } }
  ).model_params?.cloudCover
  const metrics: Array<[string, string]> = [
    ['Tổng diện tích', formatHa(summary?.totalHa ?? null)],
    ['Diện tích rừng', formatHa(summary?.forestHa ?? null)],
    ['Diện tích mỏ', formatHa(summary?.mineHa ?? null)],
    ['Thời gian xử lý', formatDuration(item.duration_ms)],
    ['Số ảnh Sentinel-2 dùng cho ghép', formatCount(item.s2_image_count)],
    [
      'Ngưỡng mây tối đa',
      Number.isFinite(Number(cloudCover)) ? `${cloudCover}%` : '— (mặc định 50%)',
    ],
    ['Độ phân giải', item.download_scale_m == null ? '—' : `${item.download_scale_m} m`],
    ['Nguồn chạy', item.trigger || '—'],
    ['Thời điểm tạo', item.created_at ? formatDateTime(item.created_at) : '—'],
  ]

  return (
    <div className="space-y-4 p-5">
      {item.error_message && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{item.error_message}</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="bg-background rounded-md border p-3">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="mt-1 text-sm font-medium">{value}</div>
          </div>
        ))}
      </div>
      {(previewUrl || geoserverDownloadUrl || item.gee_download_url) && (
        <div className="flex flex-wrap gap-2">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink /> Mở bản đồ chi tiết
              </Button>
            </a>
          )}
          {geoserverDownloadUrl ? (
            <a href={geoserverDownloadUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <Download /> Tải ảnh phân loại
              </Button>
            </a>
          ) : item.gee_download_url ? (
            <a href={item.gee_download_url} target="_blank" rel="noreferrer">
              <Button
                size="sm"
                variant="outline"
                tooltip="Ảnh tạm từ vệ tinh, có hiệu lực khoảng 1 giờ."
              >
                <Download /> Tải ảnh (tạm ~1 giờ)
              </Button>
            </a>
          ) : null}
        </div>
      )}
      <div>
        <div className="mb-2 text-sm font-medium">Chú giải và diện tích từng lớp</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(summary?.legend ?? []).map((entry) => (
            <div
              key={entry.classId}
              className="bg-background flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-sm border"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate">{entry.nameVi}</span>
              </div>
              <span className="font-medium whitespace-nowrap">{formatHa(entry.ha)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDuration(value: number | null | undefined) {
  const milliseconds = finiteNumber(value)
  if (milliseconds == null) return '—'
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`
  const seconds = milliseconds / 1000
  return seconds < 60
    ? `${seconds.toFixed(1)} giây`
    : `${Math.floor(seconds / 60)} phút ${Math.round(seconds % 60)} giây`
}

function formatCount(value: number | null | undefined) {
  const number = finiteNumber(value)
  return number == null ? '—' : number.toLocaleString('vi-VN')
}
