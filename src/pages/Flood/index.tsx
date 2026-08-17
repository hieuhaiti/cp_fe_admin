import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  Activity,
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilterX,
  History,
  Layers3,
  Loader2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const LEGEND_MODULE_LABELS: Record<string, string> = {
  event: 'Hiện trạng sự kiện',
  hand: 'Kịch bản địa hình',
  rain: 'Rủi ro mưa',
  impact: 'Tác động ngập',
  trend: 'Phân tích ngập theo năm',
}

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

function stringDefault(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
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

function formatNumber(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
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
  const canCalibrate = hasPerm(user, 'flood', 'calibrate')
  const canPublish = hasPerm(user, 'flood', 'publish')
  const [activeTab, setActiveTab] = useState('submit')
  const [analysisYear, setAnalysisYear] = useState(() => String(new Date().getFullYear() - 1))
  const [orbitPass, setOrbitPass] = useState('ASCENDING')
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [legendModuleFilter, setLegendModuleFilter] = useState<FloodLegendModule | 'all'>('all')
  const [editingLegend, setEditingLegend] = useState<FloodLegend | null>(null)
  const [paletteRows, setPaletteRows] = useState<string[]>([])
  const [legendForm, setLegendForm] = useState<{ label: { vi: string; en: string }; min: number; max: number }>({
    label: { vi: '', en: '' }, min: 0, max: 1
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
    [
      'flood',
      'runs',
      historyPage,
      historyPageSize,
      statusFilter,
      fromFilter,
      toFilter,
    ],
    () =>
      floodService.getRuns({
        page: historyPage,
        limit: historyPageSize,
        module: 'trend',
        status: statusFilter === 'all' ? undefined : statusFilter,
        from: fromFilter || undefined,
        to: toFilter ? exclusiveEndDate(toFilter) : undefined,
      }),
    { enabled: activeTab === 'runs' && historyExpanded },
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
    { enabled: activeTab === 'config' },
    false
  )
  const trendConfig = trendConfigQuery.data?.data as TrendConfig | undefined
  const detailQuery = useApiQuery(
    ['flood', 'run', selectedRunId],
    () => floodService.getRun(selectedRunId as number),
    { enabled: activeTab === 'runs' && historyExpanded && selectedRunId != null },
    false
  )

  const legendsQuery = useApiQuery(
    ['flood', 'legends', legendModuleFilter],
    () => floodService.getLegends(legendModuleFilter === 'all' ? undefined : legendModuleFilter),
    { enabled: activeTab === 'legends' },
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
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'trend-config'] }) },
  )
  const resetTrendConfigMutation = useApiMutation(
    (key?: string) => floodService.resetTrendConfigField(key),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flood', 'trend-config'] }) },
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
    setPaletteRows(legend.entries.map(e => e.color.replace('#', '')))
    setLegendForm({
      label: { vi: legend.label.vi, en: legend.label.en },
      min: legend.min ?? 0,
      max: legend.max ?? 1,
    })
  }

  const submitMutation = useApiMutation(
    (payload: { module: FloodModule; mode: FloodRunMode; config: Record<string, unknown> }) =>
      floodService.submit(payload),
    { onSuccess: () => refreshAll() }
  )
  const rerunMutation = useApiMutation((id: number) => floodService.rerun(id), {
    onSuccess: () => refreshAll(),
  })
  const cancelMutation = useApiMutation((id: number) => floodService.cancel(id), {
    onSuccess: () => refreshAll(),
  })
  const dashboard = dashboardQuery.data?.data
  const runDetail = detailQuery.data?.data
  const floodConfig = configQuery.data?.data as
    | {
        defaults?: Record<string, Record<string, unknown>>
        versions?: Partial<Record<FloodModule, string>>
        configVersion?: string
        probabilityCalibrated?: boolean
      }
    | undefined

  const publishedCount = useMemo(() => {
    return (dashboard?.layers ?? []).filter((l: { module?: string }) => l.module === 'trend').length
  }, [dashboard])

  const latestTrend = dashboard?.modules?.['trend']

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
    (historyExpanded && runsQuery.isFetching)

  const submitRun = () => {
    const year = Number(analysisYear)
    if (!Number.isInteger(year) || year < 2015 || year > 2100) {
      toast.error('Năm phân tích phải từ 2015 đến 2100.')
      return
    }
    if (!orbitPass.trim()) {
      toast.error('Hãy chọn quỹ đạo Sentinel-1.')
      return
    }
    submitMutation.mutate({
      module: 'trend',
      mode: 'product',
      config: { analysisYear: year, orbitPass },
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b p-4 sm:p-6 sm:pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-start gap-2 sm:items-center">
              <Waves className="mt-0.5 size-6 shrink-0 text-sky-600 sm:mt-0" />
              <h1 className="text-xl font-bold sm:text-2xl">Ngập lụt và thủy văn Cẩm Phả</h1>
            </div>
          </div>
          <Button className="w-full sm:w-auto" variant="outline" onClick={refreshAll}>
            <RefreshCcw className={cn('size-4', refreshingPage && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-6 sm:p-6">
        {/* Dashboard cards */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={latestTrend ? (latestTrend.status === 'SUCCEEDED' ? CheckCircle2 : Activity) : Clock3}
            label="Trạng thái lần chạy gần nhất"
            value={latestTrend ? STATUS_LABELS[latestTrend.status as FloodRunStatus] || latestTrend.status : 'Chưa có'}
            hint={latestTrend ? formatDateTime(latestTrend.finishedAt) : 'Chưa có lượt phân tích'}
          />
          <MetricCard
            icon={CalendarDays}
            label="Năm phân tích gần nhất"
            value={latestTrend?.analysisYear ? String(latestTrend.analysisYear) : '—'}
            hint="Năm của lượt phân tích hoàn thành gần nhất"
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="runs">
              <span className="sm:hidden">Lịch sử</span>
              <span className="hidden sm:inline">Lịch sử chạy</span>
            </TabsTrigger>
            <TabsTrigger value="submit">
              <span className="sm:hidden">Tạo lượt</span>
              <span className="hidden sm:inline">Tạo lượt phân tích</span>
            </TabsTrigger>
            <TabsTrigger value="legends">
              <span className="sm:hidden">Chú giải</span>
              <span className="hidden sm:inline">Chú giải bản đồ</span>
            </TabsTrigger>
            <TabsTrigger value="config">
              <span className="sm:hidden">Cấu hình</span>
              <span className="hidden sm:inline">Cấu hình mô hình</span>
            </TabsTrigger>
          </TabsList>

          {/* ── HISTORY TAB ── */}
          <TabsContent value="runs" className="space-y-4">
            <Card>
              <CardHeader className="p-0">
                <button
                  type="button"
                  className="focus-visible:ring-ring flex w-full items-start justify-between gap-4 rounded-lg p-4 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:p-6"
                  aria-expanded={historyExpanded}
                  aria-controls="flood-run-history"
                  onClick={() => setHistoryExpanded((current) => !current)}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="rounded-md bg-sky-100 p-2 text-sky-700">
                      <History className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold">Lịch sử vận hành</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {historyExpanded && runsQuery.isFetching ? (
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    ) : null}
                    {historyExpanded && !runsQuery.isFetching ? (
                      <Badge variant="secondary">{historyTotal.toLocaleString('vi-VN')} lượt</Badge>
                    ) : null}
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground size-5 transition-transform',
                        historyExpanded && 'rotate-180'
                      )}
                    />
                  </span>
                </button>
              </CardHeader>
              {historyExpanded ? (
                <CardContent id="flood-run-history" className="space-y-4 border-t p-4 sm:p-6">
                  <div className="rounded-lg border bg-slate-50/60 p-3 sm:p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => runsQuery.refetch()}
                          disabled={runsQuery.isFetching}
                        >
                          <RefreshCcw
                            className={cn('size-4', runsQuery.isFetching && 'animate-spin')}
                          />
                          Làm mới lịch sử
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
                  </div>

                  <div className="overflow-hidden rounded-md border [&>div]:max-h-[34rem]">
                    <Table className="min-w-[52rem]">
                      <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Năm</TableHead>
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
                          const year = run.params_snapshot?.analysisYear ?? '—'
                          const areaHa = run.result_metadata?.areaStats?.floodExtentAreaHa
                          const population = run.result_metadata?.areaStats?.populationAffected
                          return (
                            <TableRow
                              key={run.id}
                              data-state={selectedRunId === run.id ? 'selected' : undefined}
                              className="cursor-pointer"
                              onClick={() => setSelectedRunId(run.id)}
                            >
                              <TableCell className="font-mono">
                                #{run.id}.{run.attempt_no}
                              </TableCell>
                              <TableCell>{year}</TableCell>
                              <TableCell>
                                <StatusBadge status={run.status} />
                              </TableCell>
                              <TableCell>
                                {areaHa != null ? `${Number(areaHa).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ha` : '—'}
                              </TableCell>
                              <TableCell>
                                {population != null ? `${Math.round(Number(population)).toLocaleString('vi-VN')} người` : '—'}
                              </TableCell>
                              <TableCell>{formatDateTime(run.created_at)}</TableCell>
                              <TableCell>
                                <div
                                  className="flex justify-end gap-1"
                                  onClick={(event) => event.stopPropagation()}
                                >
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
                            <TableCell
                              colSpan={7}
                              className="text-muted-foreground py-10 text-center"
                            >
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
              ) : null}
            </Card>

            {historyExpanded && selectedRunId ? (
              <TrendMetricsCard runDetail={runDetail} />
            ) : null}
          </TabsContent>

          {/* ── SUBMIT TAB ── */}
          <TabsContent value="submit">
            <div className="grid w-full gap-4 lg:grid-cols-12">
              <Card className="min-w-0 lg:col-span-12">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="size-5 text-sky-600" />
                    Tạo lượt phân tích ngập
                  </CardTitle>
                  <CardDescription>
                    Chọn năm và quỹ đạo — hệ thống tự sinh 4 mùa (Xuân · Hạ · Thu · Đông) và kỳ
                    nền khô (T1–T4). Dùng thuật toán VH-only Otsu 3 tầng với dữ liệu
                    WorldPop và WorldCover cho tác động.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-sm">
                    Hệ thống tự sinh: Xuân (T3–T5) · Hạ (T6–T8) · Thu (T9–T11) · Đông (T12–T2 năm sau).
                    Kỳ nền khô: T1–T4. Các ngưỡng thuật toán được kiểm soát theo phiên bản cấu hình.
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 max-w-xl">
                    <div className="space-y-2">
                      <Label htmlFor="analysisYear">Năm phân tích *</Label>
                      <Input
                        id="analysisYear"
                        type="number"
                        min="2015"
                        max="2100"
                        step="1"
                        value={analysisYear}
                        onChange={(e) => setAnalysisYear(e.target.value)}
                        placeholder={String(new Date().getFullYear() - 1)}
                      />
                      <p className="text-muted-foreground text-xs">
                        Từ 2015. Hệ thống sẽ tự xây dựng tất cả các kỳ của năm đã chọn.
                      </p>
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
                      <p className="text-muted-foreground text-xs">
                        AUTO: so sánh coverage ASCENDING / DESCENDING rồi chọn quỹ đạo có nhiều ảnh hợp lệ hơn.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-800 space-y-1">
                    <p className="font-medium">Thông số thuật toán</p>
                    <p>VH-only · Otsu per-stratum · HAND 15 m · Slope 5° · freqAlertMin 2 mùa</p>
                    <p>Tác động: WorldPop VNM 2020 · WorldCover · ESRI LULC (lcYear 2018→2023)</p>
                    <p className="text-sky-600">Thay đổi thông số nâng cao trong tab Cấu hình mô hình.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sky-200 bg-sky-50/50 lg:col-span-12">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Sẵn sàng tạo lượt phân tích?</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Hệ thống sẽ kiểm tra dữ liệu, lưu lại phiên bản mô hình và đưa tác vụ vào hàng
                      đợi xử lý trên vệ tinh.
                    </p>
                  </div>
                  <Button
                    className="w-full shrink-0 sm:w-auto"
                    onClick={submitRun}
                    disabled={!canRun || submitMutation.isPending}
                  >
                    {submitMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                    {submitMutation.isPending ? 'Đang gửi...' : 'Tạo lượt phân tích'}
                  </Button>
                </CardContent>
                {!canRun ? (
                  <p className="text-muted-foreground px-4 pb-4 text-sm">
                    Tài khoản hiện tại chỉ có quyền xem.
                  </p>
                ) : null}
              </Card>
            </div>
          </TabsContent>

          {/* ── LEGENDS TAB ── */}
          <TabsContent value="legends">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="size-5 text-sky-600" />
                      Chú giải bản đồ ngập lụt
                    </CardTitle>
                    <CardDescription>
                      Chỉ có thể thay đổi <strong>bảng màu (hex)</strong> và <strong>nhãn tiếng Việt</strong>.
                      Kiểu legend (binary / continuous / class) do hệ thống tự xác định theo số màu và
                      khoảng min–max — không thay đổi trực tiếp được.
                    </CardDescription>
                    <p className="text-muted-foreground text-xs">
                      Màu nhập dạng hex không có dấu <code>#</code>, cách nhau bởi dấu phẩy. Ví dụ:{' '}
                      <code>deebf7,9ecae1,4292c6</code>. Số màu quyết định bước nhảy trên bản đồ.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={legendModuleFilter}
                      onValueChange={(v) => {
                        setLegendModuleFilter(v as FloodLegendModule | 'all')
                        setEditingLegend(null)
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="trend">Phân tích ngập theo năm</SelectItem>
                        <SelectItem value="event">Hiện trạng sự kiện</SelectItem>
                        <SelectItem value="hand">Kịch bản địa hình</SelectItem>
                        <SelectItem value="rain">Rủi ro mưa</SelectItem>
                        <SelectItem value="impact">Tác động ngập</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() =>
                        queryClient.invalidateQueries({ queryKey: ['flood', 'legends'] })
                      }
                      tooltip="Làm mới"
                    >
                      <RefreshCcw
                        className={cn('size-4', legendsQuery.isFetching && 'animate-spin')}
                      />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {legendsQuery.isFetching && !legends.length ? (
                  <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải chú giải...
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-48">Lớp bản đồ</TableHead>
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
                            <p className="font-mono text-xs">{legend.code}</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {LEGEND_MODULE_LABELS[legend.module ?? ''] ?? legend.module}
                            </p>
                            {legend.hasOverride ? (
                              <Badge
                                variant="outline"
                                className="mt-1 border-amber-300 text-[10px] text-amber-600"
                              >
                                đã chỉnh sửa
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{legend.label.vi}</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              Kiểu: {LEGEND_KIND_LABELS[legend.kind]}
                            </p>
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
                                      if (
                                        window.confirm(
                                          `Khôi phục '${legend.code}' về mặc định?`
                                        )
                                      )
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
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground py-10 text-center"
                          >
                            Không có chú giải phù hợp.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                )}
              </CardContent>

              <Dialog open={editingLegend !== null} onOpenChange={(open) => { if (!open) setEditingLegend(null) }}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="font-mono text-base">{editingLegend?.code}</span>
                      <Badge variant="outline" className="text-xs">{LEGEND_MODULE_LABELS[editingLegend?.module ?? ''] ?? editingLegend?.module}</Badge>
                    </DialogTitle>
                    <DialogDescription>
                      Chỉ thay đổi được <strong>nhãn tiếng Việt</strong> và <strong>bảng màu</strong>.
                      Kiểu legend ({LEGEND_KIND_LABELS[editingLegend?.kind ?? '']}) do hệ thống xác định tự động
                      dựa trên số màu và khoảng min–max.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label>Nhãn hiển thị (tiếng Việt)</Label>
                      <Input
                        value={legendForm.label.vi}
                        onChange={e => setLegendForm(f => ({ ...f, label: { ...f.label, vi: e.target.value } }))}
                        placeholder="Tên lớp bản đồ"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Khoảng giá trị (Min – Max)</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-24" value={legendForm.min}
                          onChange={e => setLegendForm(f => ({ ...f, min: Number(e.target.value) }))} />
                        <span className="text-muted-foreground">–</span>
                        <Input type="number" className="w-24" value={legendForm.max}
                          onChange={e => setLegendForm(f => ({ ...f, max: Number(e.target.value) }))} />
                      </div>
                      {paletteRows.length >= 2 && editingLegend?.kind === 'continuous' && (
                        <p className="text-muted-foreground text-xs">
                          Dải liên tục · bước nhảy ={' '}
                          <code>({legendForm.max} − {legendForm.min}) / ({paletteRows.length} − 1) ={' '}
                            {((legendForm.max - legendForm.min) / (paletteRows.length - 1)).toFixed(3)}
                          </code>{' '}
                          · mỗi màu ứng với 1 mốc tick trên bản đồ.
                        </p>
                      )}
                      {editingLegend?.kind === 'class' && (
                        <p className="text-muted-foreground text-xs">
                          Phân lớp · mỗi màu = 1 cấp giá trị nguyên từ {legendForm.min} đến {legendForm.min + paletteRows.length - 1}.
                          Thay đổi số màu sẽ thay đổi số cấp.
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
                        <Button type="button" size="xs" variant="outline"
                          onClick={() => setPaletteRows(r => [...r, 'cccccc'])}>
                          + Thêm màu
                        </Button>
                      </div>
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left w-8">#</th>
                              <th className="px-3 py-2 text-left">Xem trước</th>
                              <th className="px-3 py-2 text-left">Mã hex</th>
                              <th className="px-3 py-2 text-left">Giá trị tick</th>
                              <th className="px-3 py-2 w-8"></th>
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
                                tickValue = (legendForm.min + (legendForm.max - legendForm.min) * t).toFixed(2)
                              }
                              return (
                                <tr key={idx} className="border-b last:border-0">
                                  <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={`#${hex.padEnd(6, '0')}`}
                                        className="h-7 w-10 cursor-pointer rounded border p-0.5"
                                        onChange={e => {
                                          const newHex = e.target.value.replace('#', '')
                                          setPaletteRows(r => r.map((c, i) => i === idx ? newHex : c))
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
                                      onChange={e => {
                                        const v = e.target.value.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '')
                                        setPaletteRows(r => r.map((c, i) => i === idx ? v : c))
                                      }}
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                    {tickValue}
                                  </td>
                                  <td className="px-3 py-2">
                                    {paletteRows.length > 1 && (
                                      <Button type="button" size="icon-xs" variant="ghost"
                                        onClick={() => setPaletteRows(r => r.filter((_, i) => i !== idx))}>
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
                    <Button variant="outline" onClick={() => setEditingLegend(null)}>Hủy</Button>
                    <Button
                      disabled={updateLegendMutation.isPending || paletteRows.filter(Boolean).length === 0}
                      onClick={() => updateLegendMutation.mutate({
                        code: editingLegend!.code,
                        body: { ...legendForm, palette: paletteRows.filter(Boolean) },
                      })}
                    >
                      {updateLegendMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          </TabsContent>

          {/* ── CONFIG TAB ── */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings2 className="size-5" />
                  Cấu hình đã phiên bản hóa
                </CardTitle>
                <CardDescription>
                  Thông số chuẩn do hệ thống kiểm soát. Chỉ cán bộ kỹ thuật cần xem chi tiết kỹ thuật.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ConfigFact label="Phiên bản cấu hình" value={floodConfig?.configVersion || '—'} />
                  <ConfigFact label="Phiên bản mô hình" value={floodConfig?.versions?.trend || '—'} />
                </div>
              </CardContent>
            </Card>

            {/* Trend FINAL field metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-emerald-600" />
                  Mô hình phân tích ngập
                </CardTitle>
                <CardDescription>
                  Các tham số điều chỉnh thuật toán VH-only Otsu 3 tầng. Thông số cơ bản dùng khi tạo lượt chạy; nâng cao dành cho chuyên gia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trendConfigQuery.isFetching && !trendConfig ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Đang tải cấu hình...
                  </div>
                ) : trendConfig ? (
                  <>
                    <TrendConfigSection
                      title="Thông số cơ bản"
                      fields={trendConfig.fields.filter((f) => f.category === 'basic')}
                      defaults={trendConfig.defaults}
                      onSave={canRun ? handleTrendConfigSave : undefined}
                      onReset={canRun ? handleTrendConfigReset : undefined}
                    />
                    <details className="group rounded-lg border">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-medium">
                        <span>Thông số nâng cao</span>
                        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
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
                    <details className="group rounded-lg border">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-medium">
                        <span>Thông số chuyên gia</span>
                        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
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
                  <p className="text-muted-foreground py-4 text-sm">Không thể tải cấu hình mô hình.</p>
                )}
              </CardContent>
            </Card>

            {/* Raw JSON */}
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">Xem dữ liệu kỹ thuật (JSON)</summary>
              <pre className="bg-muted/30 mt-3 max-h-112 overflow-auto rounded-md p-4 text-xs">
                {JSON.stringify(floodConfig ?? {}, null, 2)}
              </pre>
            </details>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ConfigFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
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
      {title && <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const isEditing = editingKey === f.key
          const currentDisplay = fmtVal(f, f.current)
          const defaultDisplay = fmtVal(f, f.default ?? defaults[f.key])
          return (
            <div
              key={f.key}
              className={cn(
                'rounded-md border p-3 space-y-1',
                f.hasOverride && 'border-amber-300 bg-amber-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{f.label}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {f.hasOverride && (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">đã chỉnh</Badge>
                  )}
                  {f.required && (
                    <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700">bắt buộc</Badge>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-snug">{f.description}</p>

              {isEditing ? (
                <div className="pt-1 space-y-1.5">
                  {f.options ? (
                    <Select value={draftValue} onValueChange={setDraftValue}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === 'boolean' ? (
                    <Select value={draftValue} onValueChange={setDraftValue}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true" className="text-xs">Bật</SelectItem>
                        <SelectItem value="false" className="text-xs">Tắt</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-7 text-xs font-mono"
                      type={f.type === 'number' ? 'number' : 'text'}
                      min={f.min}
                      max={f.max}
                      step={f.type === 'number' ? 'any' : undefined}
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(f); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                    />
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs px-2" disabled={saving} onClick={() => saveEdit(f)}>
                      {saving ? <Loader2 className="size-3 animate-spin" /> : 'Lưu'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={cancelEdit}>Hủy</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground text-xs">Hiện tại:</span>
                    <span className={cn('font-mono text-xs font-semibold truncate', f.hasOverride ? 'text-amber-700' : '')}>{currentDisplay}</span>
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
                <p className="text-muted-foreground text-[10px]">Khoảng: {f.min} – {f.max}{f.unit ? ` ${f.unit}` : ''}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TrendMetricsCard({ runDetail }: { runDetail: FloodRunDetail | undefined }) {
  type TrendMeta = {
    areaStats?: {
      floodExtentAreaHa?: number
      frequentFloodAreaHa?: number
      newFloodAreaHa?: number
      cropAffectedAreaHa?: number
      builtAffectedAreaHa?: number
      populationAffected?: number
    }
    analysisPeriods?: Array<{ season: string; imageCount?: number; valid?: boolean }>
    analysisYear?: number
    orbitPass?: string
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

  const SEASON_LABELS: Record<string, string> = {
    spring: 'Xuân', summer: 'Hạ', autumn: 'Thu', winter: 'Đông',
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-emerald-600" />
          Kết quả phân tích ngập{meta.analysisYear ? ` năm ${meta.analysisYear}` : ''}
        </CardTitle>
        <CardDescription>
          Tóm tắt kết quả phân tích VH-only Otsu 3 tầng · quỹ đạo {meta.orbitPass ?? '—'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Diện tích ngập (flood_extent)</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.floodExtentAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Ngập tái diễn (≥2 mùa)</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.frequentFloodAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Ngập mới (new_flood)</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.newFloodAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Dân số bị ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtPop(stats.populationAffected)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Đất nông nghiệp bị ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.cropAffectedAreaHa)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground text-xs">Đất xây dựng bị ảnh hưởng</div>
            <div className="mt-1 text-lg font-semibold">{fmtHa(stats.builtAffectedAreaHa)}</div>
          </div>
        </div>
        {periods.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Chất lượng dữ liệu theo mùa</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {periods.map((p) => (
                <div
                  key={p.season}
                  className={cn(
                    'rounded-md border p-3 text-center',
                    p.valid === false ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                  )}
                >
                  <p className="font-medium text-sm">{SEASON_LABELS[p.season] ?? p.season}</p>
                  <p className={cn('mt-1 text-xs', p.valid === false ? 'text-amber-700' : 'text-emerald-700')}>
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
