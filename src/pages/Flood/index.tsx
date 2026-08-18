import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  Activity,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  FilterX,
  History,
  Layers3,
  Loader2,
  Map as MapIcon,
  MapPin,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Waves,
  X,
} from 'lucide-react'
import { floodService, useApiMutation, useApiQuery } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { hasPerm } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type {
  FloodLegend,
  FloodLegendModule,
  FloodModule,
  FloodRunDetail,
  FloodRunMode,
  FloodRunStatus,
  TrendConfig,
  TrendConfigField,
  UpdateLegendBody,
} from '@/types/api'
import FloodMap, { type FloodMapLayer } from '@/components/features/FloodMap'
import { buildGeoserverRasterTileUrl, buildMapProxyRasterTileUrl } from '@/lib/geoserver'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const LEGEND_KIND_LABELS: Record<string, string> = {
  binary: 'Nhị phân (1 màu)',
  class: 'Phân lớp (mỗi màu 1 cấp)',
  continuous: 'Dải liên tục (bước nhảy đều)',
}

const LIVE_STATUSES = new Set<FloodRunStatus>([
  'QUEUED',
  'COMPUTING',
  'EXPORTING',
  'HARVESTING',
  'VALIDATING',
  'ARCHIVING',
  'PUBLISHING',
])

const STATUS_LABELS: Record<FloodRunStatus, string> = {
  QUEUED: 'Đang chờ',
  COMPUTING: 'Đang tính toán',
  EXPORTING: 'Đang xuất',
  HARVESTING: 'Đang thu nhận',
  VALIDATING: 'Đang kiểm định',
  ARCHIVING: 'Đang lưu trữ',
  PUBLISHING: 'Đang công bố',
  SUCCEEDED: 'Hoàn thành',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  DLQ: 'Cần xử lý',
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('vi-VN')
}

function exclusiveEndDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return value
  parsed.setUTCDate(parsed.getUTCDate() + 1)
  return parsed.toISOString()
}

function StatusBadge({ status }: { status: FloodRunStatus }) {
  const tone =
    status === 'SUCCEEDED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'FAILED' || status === 'DLQ'
        ? 'border-red-200 bg-red-50 text-red-700'
        : status === 'CANCELLED'
          ? 'border-slate-200 bg-slate-50 text-slate-600'
          : 'border-amber-200 bg-amber-50 text-amber-700'
  return (
    <Badge variant="outline" className={tone}>
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}

export default function FloodPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canRun = hasPerm(user, 'flood', 'run')
  const canPublish = hasPerm(user, 'flood', 'publish')
  const mapSectionRef = useRef<HTMLDivElement | null>(null)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [monitorStart, setMonitorStart] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [monitorEnd, setMonitorEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [orbitPass, setOrbitPass] = useState('AUTO')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const legendModuleFilter: FloodLegendModule | 'all' = 'all'
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})
  const [editingLegend, setEditingLegend] = useState<FloodLegend | null>(null)
  const [paletteRows, setPaletteRows] = useState<string[]>([])
  const [legendForm, setLegendForm] = useState<{
    label: { vi: string; en: string }
    min: number
    max: number
  }>({
    label: { vi: '', en: '' },
    min: 0,
    max: 1,
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['flood'] })
  }

  const IDLE_POLL_MS = 30_000
  const ACTIVE_POLL_MS = 5_000
  const queueQuery = useApiQuery(['flood', 'queue'], () => floodService.getQueue(), {}, false)
  const queue = queueQuery.data?.data
  const pollInterval = queue?.active || queue?.pending?.length ? ACTIVE_POLL_MS : IDLE_POLL_MS
  const refetchQueue = queueQuery.refetch

  useEffect(() => {
    const timer = setInterval(() => refetchQueue(), pollInterval)
    return () => clearInterval(timer)
  }, [pollInterval, refetchQueue])

  const runsQuery = useApiQuery(
    ['flood', 'runs', historyPage, historyPageSize, statusFilter, fromFilter, toFilter],
    () =>
      floodService.getRuns({
        page: historyPage,
        limit: historyPageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from: fromFilter || undefined,
        to: toFilter ? exclusiveEndDate(toFilter) : undefined,
      }),
    {},
    false
  )
  const runs = useMemo(() => runsQuery.data?.data?.items ?? [], [runsQuery.data])
  const historyTotal = Number(runsQuery.data?.metadata?.total ?? runs.length)
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize))
  const historyStart = historyTotal ? (historyPage - 1) * historyPageSize + 1 : 0
  const historyEnd = Math.min(historyPage * historyPageSize, historyTotal)

  const dashboardQuery = useApiQuery(
    ['flood', 'dashboard'],
    () => floodService.getDashboard(),
    { refetchInterval: pollInterval },
    false
  )
  const configQuery = useApiQuery(['flood', 'config'], () => floodService.getConfig(), {}, false)
  const trendConfigQuery = useApiQuery(
    ['flood', 'trend-config'],
    () => floodService.getTrendConfig(),
    {},
    false
  )
  const trendConfig = trendConfigQuery.data?.data as TrendConfig | undefined
  const selectedRunQuery = useApiQuery(
    ['flood', 'run', selectedRunId],
    () => floodService.getRun(selectedRunId as number),
    { enabled: selectedRunId != null },
    false
  )
  const selectedRunDetail = selectedRunQuery.data?.data

  const mapLegendsQuery = useApiQuery(
    ['flood', 'legends-map'],
    () => floodService.getLegends(undefined),
    {},
    false
  )
  const mapLegends = useMemo<FloodLegend[]>(
    () => mapLegendsQuery.data?.data ?? [],
    [mapLegendsQuery.data]
  )

  const legendsQuery = useApiQuery(
    ['flood', 'legends', legendModuleFilter],
    () => floodService.getLegends(legendModuleFilter === 'all' ? undefined : legendModuleFilter),
    {},
    false
  )
  const legends = useMemo<FloodLegend[]>(() => legendsQuery.data?.data ?? [], [legendsQuery.data])

  const updateLegendMutation = useApiMutation(
    ({ code, body }: { code: string; body: UpdateLegendBody }) =>
      floodService.updateLegend(code, body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['flood', 'legends'] })
        setEditingLegend(null)
      },
    }
  )
  const resetLegendMutation = useApiMutation((code: string) => floodService.resetLegend(code), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'legends'] }),
  })

  const putTrendConfigMutation = useApiMutation(
    (patch: Record<string, unknown>) => floodService.putTrendConfig(patch),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'trend-config'] }) }
  )
  const resetTrendConfigMutation = useApiMutation(
    (key?: string) => floodService.resetTrendConfigField(key),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'trend-config'] }) }
  )

  const handleTrendConfigSave = async (key: string, value: unknown) => {
    await putTrendConfigMutation.mutateAsync({ [key]: value })
    toast.success(`Đã cập nhật thông số "${key}"`)
  }
  const handleTrendConfigReset = async (key: string) => {
    await resetTrendConfigMutation.mutateAsync(key)
    toast.success(`Đã khôi phục thông số "${key}" về mặc định`)
  }

  const openLegendEditor = (legend: FloodLegend) => {
    setEditingLegend(legend)
    setPaletteRows(legend.entries.map((e) => e.color.replace('#', '')))
    setLegendForm({
      label: { vi: legend.label.vi, en: legend.label.en },
      min: legend.min ?? 0,
      max: legend.max ?? 1,
    })
  }

  const submitMutation = useApiMutation(
    (payload: { module: FloodModule; mode: FloodRunMode; config: Record<string, unknown> }) =>
      floodService.submit(payload),
    {
      onSuccess: () => {
        refreshAll()
        setSubmitDialogOpen(false)
      },
    }
  )
  const rerunMutation = useApiMutation((id: number) => floodService.rerun(id), {
    onSuccess: () => refreshAll(),
  })
  const cancelMutation = useApiMutation((id: number) => floodService.cancel(id), {
    onSuccess: () => refreshAll(),
  })
  const publishArtifactMutation = useApiMutation((id: number) => floodService.publishArtifact(id), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'run', selectedRunId] }),
  })
  const unpublishArtifactMutation = useApiMutation(
    (id: number) => floodService.unpublishArtifact(id),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'run', selectedRunId] }),
    }
  )
  const dashboard = dashboardQuery.data?.data

  const publishedCount = useMemo(() => {
    return (dashboard?.layers ?? []).filter((l: { module?: string }) => l.module === 'trend').length
  }, [dashboard])

  const latestTrend = dashboard?.modules?.['trend']

  // Auto-select the latest successful trend run once when the dashboard first loads.
  const hasAutoSelected = useRef(false)
  useEffect(() => {
    if (!hasAutoSelected.current && latestTrend?.id && latestTrend.status === 'SUCCEEDED') {
      hasAutoSelected.current = true
      setSelectedRunId(Number(latestTrend.id))
    }
  }, [latestTrend])

  const resetHistoryFilters = () => {
    setStatusFilter('all')
    setFromFilter('')
    setToFilter('')
    setHistoryPage(1)
    setSelectedRunId(null)
  }

  const hasHistoryFilters = statusFilter !== 'all' || Boolean(fromFilter) || Boolean(toFilter)
  const refreshingPage =
    dashboardQuery.isFetching ||
    queueQuery.isFetching ||
    configQuery.isFetching ||
    runsQuery.isFetching

  const derivedDrySeason = useMemo(() => {
    if (!monitorStart) return null
    try {
      const ms = new Date(monitorStart + 'T00:00:00Z')
      const y = ms.getUTCFullYear()
      const dryEndOfY = new Date(Date.UTC(y, 4, 0))
      const yr = dryEndOfY < ms ? y : y - 1
      const lastDay = new Date(Date.UTC(yr, 4, 0)).getUTCDate()
      return { start: `${yr}-01-01`, end: `${yr}-04-${String(lastDay).padStart(2, '0')}` }
    } catch {
      return null
    }
  }, [monitorStart])

  const submitRun = () => {
    if (!monitorStart || !monitorEnd) {
      toast.error('Hãy chọn khoảng thời gian giám sát.')
      return
    }
    if (monitorStart > monitorEnd) {
      toast.error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
      return
    }
    if (!orbitPass.trim()) {
      toast.error('Hãy chọn quỹ đạo Sentinel-1.')
      return
    }
    submitMutation.mutate({
      module: 'trend',
      mode: 'product',
      config: { monitorStart, monitorEnd, orbitPass },
    })
  }

  const openRunOnMap = (runId: number) => {
    setSelectedRunId(runId)
    setLayerVisibility({})
    window.setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Waves className="size-6 text-sky-600" /> Ngập lụt và thủy văn · TP Cẩm Phả
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={refreshingPage}>
            <RefreshCcw className={cn('size-4', refreshingPage && 'animate-spin')} />
            Làm mới
          </Button>
          {canRun && (
            <Button onClick={() => setSubmitDialogOpen(true)} disabled={submitMutation.isPending}>
              <Play className="size-4" />
              Tạo lượt phân tích
            </Button>
          )}
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={
            latestTrend ? (latestTrend.status === 'SUCCEEDED' ? CheckCircle2 : Activity) : Clock3
          }
          label="Trạng thái lần chạy gần nhất"
          value={
            latestTrend
              ? STATUS_LABELS[latestTrend.status as FloodRunStatus] || latestTrend.status
              : 'Chưa có'
          }
          hint={latestTrend ? formatDateTime(latestTrend.finishedAt) : 'Chưa có lượt phân tích'}
        />
        <MetricCard
          icon={CalendarDays}
          label="Kỳ giám sát gần nhất"
          value={(() => {
            const p = latestTrend?.params
            const m = latestTrend?.metadata
            if (p?.monitorStart && p?.monitorEnd) return `${p.monitorStart} – ${p.monitorEnd}`
            if (m?.monitorStart && m?.monitorEnd) return `${m.monitorStart} – ${m.monitorEnd}`
            const year = p?.analysisYear ?? m?.analysisYear
            return year != null ? String(year) : '—'
          })()}
          hint="Khoảng thời gian giám sát gần nhất đã hoàn thành"
        />
        <MetricCard
          icon={Layers3}
          label="Lớp bản đồ đã công bố"
          value={String(publishedCount)}
          hint="Số lớp raster đang hiển thị trên bản đồ"
        />
        <MetricCard
          icon={queue?.active ? Loader2 : CheckCircle2}
          label="Hàng đợi"
          value={queue?.active ? 'Đang xử lý' : 'Sẵn sàng'}
          hint={`Chờ: ${queue?.pending?.length ?? 0} · Còn ${queue?.capacityRemaining ?? 0}/${queue?.maxPending ?? 0} vị trí`}
          spinning={Boolean(queue?.active)}
        />
      </div>

      {/* Selected run banner */}
      {selectedRunId !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-2 text-sm text-sky-800">
          <MapIcon className="size-4 shrink-0" />
          <span>
            Đang xem lượt chạy <strong>#{selectedRunId}</strong> trên bản đồ.
          </span>
          <button
            type="button"
            className="ml-auto shrink-0 opacity-60 transition-opacity hover:opacity-100"
            onClick={() => setSelectedRunId(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Inline map section */}
      <div ref={mapSectionRef} className="scroll-mt-6">
        <FloodMapPreview
          runDetail={selectedRunDetail}
          mapLegends={mapLegends}
          layerVisibility={layerVisibility}
          onToggleLayer={(code) =>
            setLayerVisibility((prev) => ({ ...prev, [code]: !(prev[code] ?? true) }))
          }
          onSetLayerVisible={(codes, visible) =>
            setLayerVisibility((prev) => {
              const next = { ...prev }
              for (const code of codes) next[code] = visible
              return next
            })
          }
          canPublish={canPublish}
          onPublish={(id) => publishArtifactMutation.mutate(id)}
          onUnpublish={(id) => unpublishArtifactMutation.mutate(id)}
        />
      </div>

      {/* Trend metrics */}
      <TrendMetricsCard runDetail={selectedRunDetail} />

      {/* History */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="size-5 text-sky-600" />
              Lịch sử vận hành
              {!runsQuery.isFetching && (
                <Badge variant="secondary">{historyTotal.toLocaleString('vi-VN')} lượt</Badge>
              )}
              {runsQuery.isFetching && (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => runsQuery.refetch()}
                disabled={runsQuery.isFetching}
              >
                <RefreshCcw className={cn('size-4', runsQuery.isFetching && 'animate-spin')} />
                Làm mới
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetHistoryFilters}
                disabled={!hasHistoryFilters}
              >
                <FilterX className="size-4" />
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="rounded-lg border bg-slate-50/60 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="history-status">Trạng thái</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(next) => {
                    setStatusFilter(next)
                    setHistoryPage(1)
                    setSelectedRunId(null)
                  }}
                >
                  <SelectTrigger id="history-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                      <SelectItem key={status} value={status}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="history-from">Từ ngày</Label>
                <Input
                  id="history-from"
                  type="date"
                  value={fromFilter}
                  max={toFilter || undefined}
                  onChange={(event) => {
                    setFromFilter(event.target.value)
                    setHistoryPage(1)
                    setSelectedRunId(null)
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="history-to">Đến ngày</Label>
                <Input
                  id="history-to"
                  type="date"
                  value={toFilter}
                  min={fromFilter || undefined}
                  onChange={(event) => {
                    setToFilter(event.target.value)
                    setHistoryPage(1)
                    setSelectedRunId(null)
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="history-page-size">Số dòng mỗi trang</Label>
                <Select
                  value={String(historyPageSize)}
                  onValueChange={(next) => {
                    setHistoryPageSize(Number(next))
                    setHistoryPage(1)
                    setSelectedRunId(null)
                  }}
                >
                  <SelectTrigger id="history-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 dòng</SelectItem>
                    <SelectItem value="20">20 dòng</SelectItem>
                    <SelectItem value="30">30 dòng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border [&>div]:max-h-136">
            <Table className="min-w-208">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Kỳ giám sát</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Diện tích ngập (ha)</TableHead>
                  <TableHead>Dân số</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsQuery.isFetching && !runs.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center">
                      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                        <Loader2 className="size-4 animate-spin" />
                        Đang tải lịch sử...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : null}
                {runs.map((run) => {
                  const snap = run.params_snapshot as Record<string, unknown> | null
                  const periodLabel =
                    snap?.monitorStart && snap?.monitorEnd
                      ? `${snap.monitorStart} – ${snap.monitorEnd}`
                      : snap?.analysisYear != null
                        ? String(snap.analysisYear)
                        : '—'
                  const areaStats = run.result_metadata?.areaStats as
                    | { floodExtentAreaHa?: number; populationAffected?: number }
                    | undefined
                  const areaHa = areaStats?.floodExtentAreaHa
                  const population = areaStats?.populationAffected
                  return (
                    <TableRow
                      key={run.id}
                      data-state={selectedRunId === run.id ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => openRunOnMap(run.id)}
                    >
                      <TableCell className="font-mono">
                        #{run.id}.{run.attempt_no}
                      </TableCell>
                      <TableCell className="max-w-40 truncate">{periodLabel}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        {areaHa != null
                          ? `${Number(areaHa).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ha`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {population != null
                          ? `${Math.round(Number(population)).toLocaleString('vi-VN')} người`
                          : '—'}
                      </TableCell>
                      <TableCell>{formatDateTime(run.created_at)}</TableCell>
                      <TableCell>
                        <div
                          className="flex justify-end gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            size="icon-xs"
                            variant="outline"
                            tooltip="Tải lên bản đồ"
                            onClick={() => openRunOnMap(run.id)}
                          >
                            <MapIcon />
                          </Button>
                          {canRun && LIVE_STATUSES.has(run.status) ? (
                            <Button
                              size="icon-xs"
                              variant="destructive"
                              tooltip="Hủy"
                              onClick={() => {
                                if (window.confirm(`Hủy lượt chạy #${run.id}?`))
                                  cancelMutation.mutate(run.id)
                              }}
                            >
                              <Ban />
                            </Button>
                          ) : null}
                          {canRun && !LIVE_STATUSES.has(run.status) ? (
                            <Button
                              size="icon-xs"
                              variant="outline"
                              tooltip="Chạy lại"
                              onClick={() => rerunMutation.mutate(run.id)}
                            >
                              <RotateCcw />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!runs.length && !runsQuery.isFetching ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                      Không có lượt chạy phù hợp với bộ lọc.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              {historyTotal
                ? `Hiển thị ${historyStart}–${historyEnd} trong ${historyTotal.toLocaleString('vi-VN')} lượt`
                : 'Chưa có dữ liệu'}
            </p>
            {historyTotalPages > 1 ? (
              <div className="max-w-full overflow-x-auto pb-1">
                <PaginationCustom
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={(page) => {
                    setHistoryPage(page)
                    setSelectedRunId(null)
                  }}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Legends collapsible */}
      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium">
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-sky-600" />
            Chú giải bản đồ ngập lụt
          </span>
          <div className="flex items-center gap-2">
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t">
          <div className="p-4">
            <p className="text-muted-foreground mb-3 text-xs">
              Min/Max quyết định giá trị lớn nhất và nhỏ nhất của chú giải. Số lượng màu quyết định
              bước nhảy.
            </p>
          </div>
          {legendsQuery.isFetching && !legends.length ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Đang tải chú giải...
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>Nhãn hiển thị</TableHead>
                  <TableHead>Bảng màu</TableHead>
                  <TableHead className="w-28">Min / Max</TableHead>
                  {canPublish ? <TableHead className="w-24 text-right">Thao tác</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {legends.map((legend) => (
                  <TableRow key={legend.code}>
                    <TableCell>
                      <p className="text-sm">{legend.label.vi}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {legend.entries.slice(0, 8).map((entry, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger>
                              <span
                                className="inline-block h-5 w-5 rounded-sm border border-black/10"
                                style={{ background: entry.color }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {entry.color}
                              {entry.value !== undefined ? ` · ${entry.value}` : ''}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {legend.entries.length > 8 ? (
                          <span className="text-muted-foreground self-center text-xs">
                            +{legend.entries.length - 8}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {legend.min} – {legend.max}
                    </TableCell>
                    {canPublish ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-xs"
                            variant="outline"
                            tooltip="Chỉnh sửa màu / nhãn"
                            onClick={() => openLegendEditor(legend)}
                          >
                            <Settings2 />
                          </Button>
                          {legend.hasOverride ? (
                            <Button
                              size="icon-xs"
                              variant="outline"
                              tooltip="Khôi phục mặc định"
                              onClick={() => {
                                if (window.confirm(`Khôi phục '${legend.code}' về mặc định?`))
                                  resetLegendMutation.mutate(legend.code)
                              }}
                            >
                              <RotateCcw />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {!legends.length && !legendsQuery.isFetching ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                      Không có chú giải phù hợp.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </div>
      </details>

      {/* Config collapsible */}
      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium">
          <span className="flex items-center gap-2">
            <Settings2 className="size-4" />
            Cấu hình mô hình
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-emerald-600" />
                Mô hình phân tích ngập
              </CardTitle>
              <CardDescription>Các tham số điều chỉnh thuật toán phân tích ngập.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {trendConfigQuery.isFetching && !trendConfig ? (
                <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Đang tải cấu hình...
                </div>
              ) : trendConfig ? (
                <>
                  <details className="group/adv rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium">
                      <span>Thông số nâng cao</span>
                      <ChevronDown className="text-muted-foreground size-4 transition-transform group-open/adv:rotate-180" />
                    </summary>
                    <div className="border-t p-4">
                      <TrendConfigSection
                        fields={trendConfig.fields.filter((f) => f.category === 'advanced')}
                        defaults={trendConfig.defaults}
                        onSave={canRun ? handleTrendConfigSave : undefined}
                        onReset={canRun ? handleTrendConfigReset : undefined}
                      />
                    </div>
                  </details>
                  <details className="group/exp rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium">
                      <span>Thông số chuyên gia</span>
                      <ChevronDown className="text-muted-foreground size-4 transition-transform group-open/exp:rotate-180" />
                    </summary>
                    <div className="border-t p-4">
                      <TrendConfigSection
                        fields={trendConfig.fields.filter((f) => f.category === 'expert')}
                        defaults={trendConfig.defaults}
                        onSave={canRun ? handleTrendConfigSave : undefined}
                        onReset={canRun ? handleTrendConfigReset : undefined}
                      />
                    </div>
                  </details>
                </>
              ) : (
                <p className="text-muted-foreground py-4 text-sm">
                  Không thể tải cấu hình mô hình.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </details>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="size-4 text-sky-600" />
              Tạo lượt phân tích ngập
            </DialogTitle>
            <DialogDescription>Chọn khoảng thời gian giám sát</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid max-w-xl gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monitorStart">Bắt đầu giám sát *</Label>
                <Input
                  id="monitorStart"
                  type="date"
                  value={monitorStart}
                  max={monitorEnd || undefined}
                  onChange={(e) => setMonitorStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monitorEnd">Kết thúc giám sát *</Label>
                <Input
                  id="monitorEnd"
                  type="date"
                  value={monitorEnd}
                  min={monitorStart || undefined}
                  onChange={(e) => setMonitorEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mùa khô tham chiếu</Label>
                <div className="bg-muted/40 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm">
                  {derivedDrySeason ? `${derivedDrySeason.start} → ${derivedDrySeason.end}` : '—'}
                </div>
                <p className="text-muted-foreground text-xs">Tự động · không cần nhập</p>
              </div>
              <div className="space-y-2">
                <Label>Quỹ đạo Sentinel-1</Label>
                <Select value={orbitPass} onValueChange={setOrbitPass}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASCENDING">ASCENDING — hướng lên</SelectItem>
                    <SelectItem value="DESCENDING">DESCENDING — hướng xuống</SelectItem>
                    <SelectItem value="AUTO">AUTO — hệ thống tự chọn tốt nhất</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submitRun} disabled={!canRun || submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
              {submitMutation.isPending ? 'Đang gửi...' : 'Tạo lượt phân tích'}
            </Button>
          </DialogFooter>
          {!canRun ? (
            <p className="text-muted-foreground text-sm">Tài khoản hiện tại chỉ có quyền xem.</p>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Legend edit Dialog */}
      <Dialog
        open={editingLegend !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLegend(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-base">{editingLegend?.code}</span>
              <Badge variant="outline" className="text-xs">
                {editingLegend?.label?.vi ?? editingLegend?.module}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Chỉ thay đổi được <strong>nhãn tiếng Việt</strong> và <strong>bảng màu</strong>. Kiểu
              legend ({LEGEND_KIND_LABELS[editingLegend?.kind ?? '']}) do hệ thống xác định tự động
              dựa trên số màu và khoảng min–max.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Nhãn hiển thị (tiếng Việt)</Label>
              <Input
                value={legendForm.label.vi}
                onChange={(e) =>
                  setLegendForm((f) => ({ ...f, label: { ...f.label, vi: e.target.value } }))
                }
                placeholder="Tên lớp bản đồ"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Khoảng giá trị (Min – Max)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-24"
                  value={legendForm.min}
                  onChange={(e) => setLegendForm((f) => ({ ...f, min: Number(e.target.value) }))}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  className="w-24"
                  value={legendForm.max}
                  onChange={(e) => setLegendForm((f) => ({ ...f, max: Number(e.target.value) }))}
                />
              </div>
              {paletteRows.length >= 2 && editingLegend?.kind === 'continuous' && (
                <p className="text-muted-foreground text-xs">
                  Dải liên tục · bước nhảy ={' '}
                  <code>
                    ({legendForm.max} − {legendForm.min}) / ({paletteRows.length} − 1) ={' '}
                    {((legendForm.max - legendForm.min) / (paletteRows.length - 1)).toFixed(3)}
                  </code>{' '}
                  · mỗi màu ứng với 1 mốc tick trên bản đồ.
                </p>
              )}
              {editingLegend?.kind === 'class' && (
                <p className="text-muted-foreground text-xs">
                  Phân lớp · mỗi màu = 1 cấp giá trị nguyên từ {legendForm.min} đến{' '}
                  {legendForm.min + paletteRows.length - 1}. Thay đổi số màu sẽ thay đổi số cấp.
                </p>
              )}
              {editingLegend?.kind === 'binary' && (
                <p className="text-muted-foreground text-xs">
                  Nhị phân · 1 màu duy nhất, không có bước nhảy.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Bảng màu ({paletteRows.length} màu)</Label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPaletteRows((r) => [...r, 'cccccc'])}
                >
                  + Thêm màu
                </Button>
              </div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground border-b text-xs">
                      <th className="w-8 px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Xem trước</th>
                      <th className="px-3 py-2 text-left">Mã hex</th>
                      <th className="px-3 py-2 text-left">Giá trị tick</th>
                      <th className="w-8 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paletteRows.map((hex, idx) => {
                      const n = paletteRows.length
                      let tickValue: string
                      if (editingLegend?.kind === 'binary') {
                        tickValue = '—'
                      } else if (editingLegend?.kind === 'class') {
                        tickValue = String(legendForm.min + idx)
                      } else {
                        const t = n <= 1 ? 0 : idx / (n - 1)
                        tickValue = (
                          legendForm.min +
                          (legendForm.max - legendForm.min) * t
                        ).toFixed(2)
                      }
                      return (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="text-muted-foreground px-3 py-2 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={`#${hex.padEnd(6, '0')}`}
                                className="h-7 w-10 cursor-pointer rounded border p-0.5"
                                onChange={(e) => {
                                  const newHex = e.target.value.replace('#', '')
                                  setPaletteRows((r) => r.map((c, i) => (i === idx ? newHex : c)))
                                }}
                              />
                              <span
                                className="inline-block h-6 w-16 rounded border border-black/10"
                                style={{ background: `#${hex}` }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-7 w-28 font-mono text-xs"
                              value={hex}
                              placeholder="rrggbb"
                              maxLength={6}
                              onChange={(e) => {
                                const v = e.target.value
                                  .replace(/^#/, '')
                                  .replace(/[^0-9a-fA-F]/g, '')
                                setPaletteRows((r) => r.map((c, i) => (i === idx ? v : c)))
                              }}
                            />
                          </td>
                          <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                            {tickValue}
                          </td>
                          <td className="px-3 py-2">
                            {paletteRows.length > 1 && (
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => setPaletteRows((r) => r.filter((_, i) => i !== idx))}
                              >
                                <X className="size-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground text-xs">
                Nhập mã hex 6 ký tự (không cần dấu #). Dùng color picker để chọn màu trực quan.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLegend(null)}>
              Hủy
            </Button>
            <Button
              disabled={updateLegendMutation.isPending || paletteRows.filter(Boolean).length === 0}
              onClick={() =>
                updateLegendMutation.mutate({
                  code: editingLegend!.code,
                  body: { ...legendForm, palette: paletteRows.filter(Boolean) },
                })
              }
            >
              {updateLegendMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  spinning = false,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
  spinning?: boolean
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Icon className={cn('size-4', spinning && 'animate-spin')} />
          {label}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-2 truncate text-lg font-semibold">{value}</p>
          </TooltipTrigger>
          <TooltipContent>{value}</TooltipContent>
        </Tooltip>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </CardContent>
    </Card>
  )
}

function TrendConfigSection({
  title,
  fields,
  defaults,
  onSave,
  onReset,
}: {
  title?: string
  fields: TrendConfigField[]
  defaults: Record<string, unknown>
  onSave?: (key: string, value: unknown) => Promise<void>
  onReset?: (key: string) => Promise<void>
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  if (!fields.length) return null

  const fmtVal = (f: TrendConfigField, v: unknown) => {
    if (v === undefined || v === null) return '—'
    if (f.type === 'boolean') return v ? 'Bật' : 'Tắt'
    if (f.options) {
      const opt = f.options.find((o) => o.value === String(v))
      return opt ? opt.label : String(v)
    }
    return f.unit ? `${v} ${f.unit}` : String(v)
  }

  const startEdit = (f: TrendConfigField) => {
    setEditingKey(f.key)
    setDraftValue(String(f.current ?? f.default ?? defaults[f.key] ?? ''))
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraftValue('')
  }

  const saveEdit = async (f: TrendConfigField) => {
    if (!onSave) return
    setSaving(true)
    try {
      let parsed: unknown = draftValue
      if (f.type === 'number') parsed = Number(draftValue)
      else if (f.type === 'boolean') parsed = draftValue === 'true'
      await onSave(f.key, parsed)
      setEditingKey(null)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (f: TrendConfigField) => {
    if (!onReset) return
    setSaving(true)
    try {
      await onReset(f.key)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const isEditing = editingKey === f.key
          const currentDisplay = fmtVal(f, f.current)
          const defaultDisplay = fmtVal(f, f.default ?? defaults[f.key])
          return (
            <div
              key={f.key}
              className={cn(
                'space-y-1 rounded-md border p-3',
                f.hasOverride && 'border-amber-300 bg-amber-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-tight font-medium">{f.label}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {f.hasOverride && (
                    <Badge
                      variant="outline"
                      className="border-amber-400 text-[10px] text-amber-700"
                    >
                      đã chỉnh
                    </Badge>
                  )}
                  {f.required && (
                    <Badge variant="outline" className="border-sky-300 text-[10px] text-sky-700">
                      bắt buộc
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-snug">{f.description}</p>

              {isEditing ? (
                <div className="space-y-1.5 pt-1">
                  {f.options ? (
                    <Select value={draftValue} onValueChange={setDraftValue}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === 'boolean' ? (
                    <Select value={draftValue} onValueChange={setDraftValue}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true" className="text-xs">
                          Bật
                        </SelectItem>
                        <SelectItem value="false" className="text-xs">
                          Tắt
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-7 font-mono text-xs"
                      type={f.type === 'number' ? 'number' : 'text'}
                      min={f.min}
                      max={f.max}
                      step={f.type === 'number' ? 'any' : undefined}
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(f)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                    />
                  )}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={saving}
                      onClick={() => saveEdit(f)}
                    >
                      {saving ? <Loader2 className="size-3 animate-spin" /> : 'Lưu'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={cancelEdit}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Hiện tại:</span>
                    <span
                      className={cn(
                        'truncate font-mono text-xs font-semibold',
                        f.hasOverride ? 'text-amber-700' : ''
                      )}
                    >
                      {currentDisplay}
                    </span>
                    {!f.hasOverride && defaultDisplay !== currentDisplay && (
                      <span className="text-muted-foreground text-xs">({defaultDisplay})</span>
                    )}
                  </div>
                  {onSave && (
                    <div className="flex shrink-0 gap-1">
                      {f.hasOverride && onReset && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-amber-600 hover:text-amber-800"
                              disabled={saving}
                              onClick={() => handleReset(f)}
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Khôi phục mặc định</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            onClick={() => startEdit(f)}
                          >
                            <Settings2 className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Chỉnh sửa</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}
              {f.min !== undefined && f.max !== undefined && (
                <p className="text-muted-foreground text-[10px]">
                  Khoảng: {f.min} – {f.max}
                  {f.unit ? ` ${f.unit}` : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FloodMapPreview({
  runDetail,
  mapLegends,
  layerVisibility,
  onToggleLayer,
  onSetLayerVisible,
  canPublish,
  onPublish,
  onUnpublish,
}: {
  runDetail: FloodRunDetail | undefined
  mapLegends: FloodLegend[]
  layerVisibility: Record<string, boolean>
  onToggleLayer: (code: string) => void
  onSetLayerVisible: (codes: string[], visible: boolean) => void
  canPublish: boolean
  onPublish: (id: number) => void
  onUnpublish: (id: number) => void
}) {
  const legendMap = useMemo(() => {
    const m: Record<string, FloodLegend> = {}
    for (const l of mapLegends) m[l.code] = l
    return m
  }, [mapLegends])

  const published = useMemo(
    () =>
      (runDetail?.artifacts ?? []).filter(
        (a) => a.publish_status === 'published' && a.workspace && a.layer_name
      ),
    [runDetail]
  )
  const unpublishedProducts = useMemo(
    () =>
      (runDetail?.artifacts ?? []).filter(
        (a) => a.publish_status !== 'published' && a.artifact_role === 'PRODUCT'
      ),
    [runDetail]
  )

  const publishedCodes = useMemo(() => published.map((a) => a.artifact_code), [published])
  const allVisible =
    publishedCodes.length > 0 && publishedCodes.every((code) => layerVisibility[code] ?? true)

  const [tileUrls, setTileUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    async function fetchUrls() {
      const entries = await Promise.all(
        published.map(async (a): Promise<[string, string]> => {
          if (a.registry_layer_id) {
            try {
              const url = await buildMapProxyRasterTileUrl(
                a.registry_layer_id,
                a.registry_is_public ?? false
              )
              return [a.artifact_code, url]
            } catch {
              // fall through to direct GeoServer
            }
          }
          const fqn = `${a.workspace}:${a.layer_name}`
          let url = buildGeoserverRasterTileUrl(fqn) ?? ''
          const effectiveStyle = a.style_name ?? (a.metadata?.style as string | undefined)
          if (url && effectiveStyle) {
            url = url.replace(
              '&bbox={bbox-epsg-3857}',
              `&styles=${encodeURIComponent(`${a.workspace}:${effectiveStyle}`)}&bbox={bbox-epsg-3857}`
            )
          }
          return [a.artifact_code, url]
        })
      )
      if (!cancelled) setTileUrls(Object.fromEntries(entries))
    }
    fetchUrls()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published])

  const mapLayers = useMemo<FloodMapLayer[]>(
    () =>
      published.map((a) => ({
        id: a.artifact_code,
        tileUrl: tileUrls[a.artifact_code] ?? '',
        visible: layerVisibility[a.artifact_code] ?? true,
        opacity: 0.88,
      })),
    [published, tileUrls, layerVisibility]
  )

  const snap = (runDetail?.params_snapshot ?? null) as Record<string, unknown> | null
  const periodLabel =
    snap?.monitorStart && snap?.monitorEnd
      ? `${snap.monitorStart} – ${snap.monitorEnd}`
      : snap?.analysisYear != null
        ? `Năm ${snap.analysisYear}`
        : null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4 text-sky-600" />
            Bản đồ preview{periodLabel ? ` · ${periodLabel}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FloodMap layers={mapLayers} heightClassName="h-[26rem] sm:h-[32rem]" />
        </CardContent>
      </Card>

      {/* Layer controls + legend */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="size-4" />
            Lớp bản đồ
            {published.length > 0 && (
              <span className="text-muted-foreground ml-auto text-[11px] font-normal">
                {published.length} lớp
              </span>
            )}
          </CardTitle>
          {published.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <Button
                size="xs"
                variant={allVisible ? 'secondary' : 'outline'}
                className="h-6 text-[11px]"
                onClick={() => onSetLayerVisible(publishedCodes, !allVisible)}
              >
                {allVisible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {allVisible ? 'Ẩn tất cả' : 'Bật tất cả'}
              </Button>
              {canPublish && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-muted-foreground h-6 text-[11px] hover:text-red-600"
                      onClick={() => {
                        if (window.confirm(`Gỡ công bố tất cả ${published.length} lớp?`))
                          published.forEach((a) => onUnpublish(a.id))
                      }}
                    >
                      <X className="size-3" />
                      Gỡ tất cả
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Thu hồi công bố toàn bộ lớp đã công bố</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="max-h-120 space-y-2 overflow-y-auto pr-2 pb-3">
          {!runDetail ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Chọn một lượt chạy từ bảng lịch sử để tải lên bản đồ.
            </p>
          ) : null}
          {runDetail && published.length === 0 && unpublishedProducts.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">Không có artifact nào.</p>
          )}

          {published.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Đã công bố
              </p>
              {published.map((a) => {
                const leg = legendMap[a.artifact_code]
                const visible = layerVisibility[a.artifact_code] ?? true
                const label = leg?.label?.vi ?? a.metadata?.label?.vi ?? a.artifact_code
                const entries = leg?.entries ?? []
                return (
                  <div
                    key={a.id}
                    className={cn(
                      'space-y-1.5 rounded-md border p-2 transition-colors',
                      visible ? 'border-sky-200 bg-sky-50/60' : 'border-border/60 bg-card'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => onToggleLayer(a.artifact_code)}
                      >
                        {visible ? (
                          <Eye className="size-3.5 shrink-0 text-sky-600" />
                        ) : (
                          <EyeOff className="text-muted-foreground size-3.5 shrink-0" />
                        )}
                        <span
                          className={cn(
                            'text-xs leading-tight font-medium',
                            !visible && 'text-muted-foreground'
                          )}
                        >
                          {label}
                        </span>
                      </button>
                      {canPublish && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground size-6 shrink-0 hover:text-red-600"
                              onClick={() => onUnpublish(a.id)}
                            >
                              <X className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Thu hồi công bố</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {entries.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pl-5">
                        {entries.slice(0, 8).map((e, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-block size-3 shrink-0 cursor-default rounded-[3px] border border-black/10"
                                style={{ backgroundColor: e.color }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {e.label?.vi ??
                                e.label?.en ??
                                (e.value != null ? String(e.value) : e.color)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {entries.length > 8 && (
                          <span className="text-muted-foreground text-[10px]">
                            +{entries.length - 8}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {unpublishedProducts.length > 0 && canPublish && (
            <div className="space-y-1.5 pt-1">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Chưa công bố
              </p>
              {unpublishedProducts.map((a) => {
                const leg = legendMap[a.artifact_code]
                const label = leg?.label?.vi ?? a.metadata?.label?.vi ?? a.artifact_code
                const isPublishing = a.publish_status === 'publishing'
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2"
                  >
                    <span className="text-muted-foreground truncate text-xs">{label}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 shrink-0 px-2 text-xs"
                      disabled={isPublishing}
                      onClick={() => onPublish(a.id)}
                    >
                      {isPublishing ? <Loader2 className="size-3 animate-spin" /> : 'Công bố'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function TrendMetricsCard({ runDetail }: { runDetail: FloodRunDetail | undefined }) {
  type TrendMeta = {
    areaStats?: {
      floodExtentAreaHa?: number
      cropAffectedAreaHa?: number
      builtAffectedAreaHa?: number
      populationAffected?: number
      drainageAlertAreaHa?: number
    }
    analysisPeriods?: Array<{ label: string; imageCount?: number; valid?: boolean }>
    monitorStart?: string
    monitorEnd?: string
    dryWindow?: { start?: string; end?: string }
    orbitRequested?: string
    orbitSelected?: string
    drySceneCount?: number
  }
  const meta = (runDetail?.result_metadata as TrendMeta | undefined) ?? {}
  const stats = meta.areaStats ?? {}
  const periods = meta.analysisPeriods ?? []
  const hasAny = stats.floodExtentAreaHa != null || stats.populationAffected != null

  if (!runDetail || runDetail.module !== 'trend' || !hasAny) return null

  const fmtHa = (v?: number) =>
    v == null ? '—' : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ha`
  const fmtPop = (v?: number) =>
    v == null ? '—' : `${Math.round(Number(v)).toLocaleString('vi-VN')} người`

  const periodLabel =
    meta.monitorStart && meta.monitorEnd ? ` (${meta.monitorStart} – ${meta.monitorEnd})` : ''

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-emerald-600" />
          Kết quả giám sát ngập{periodLabel}
        </CardTitle>
        <CardDescription>
          VH-only Otsu 3 tầng · quỹ đạo {meta.orbitSelected ?? meta.orbitRequested ?? '—'}
          {meta.dryWindow?.start
            ? ` · Mùa khô: ${meta.dryWindow.start} → ${meta.dryWindow.end}`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Diện tích vùng ghi nhận ngập</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.floodExtentAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Dân số trong vùng ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtPop(stats.populationAffected)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Cây trồng trong vùng ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.cropAffectedAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Khu xây dựng trong vùng ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.builtAffectedAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Diện tích cảnh báo tiêu thoát</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.drainageAlertAreaHa)}</div>
          </div>
        </div>
        {periods.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Chất lượng dữ liệu ảnh SAR
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              {periods.map((p) => (
                <div
                  key={p.label}
                  className={cn(
                    'rounded-md border p-3 text-center',
                    p.valid === false
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                  )}
                >
                  <p className="text-sm font-medium">{p.label}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      p.valid === false ? 'text-amber-700' : 'text-emerald-700'
                    )}
                  >
                    {p.valid === false ? '⚠ Không đủ dữ liệu' : `✓ ${p.imageCount ?? 0} ảnh`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
