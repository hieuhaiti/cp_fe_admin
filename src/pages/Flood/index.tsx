import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  Activity,
  AlertTriangle,
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Droplets,
  FilterX,
  History,
  Loader2,
  MapPin,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Waves,
} from 'lucide-react'
import { floodService, useApiMutation, useApiQuery } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { hasPerm } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type {
  FloodModule,
  FloodRunDetail,
  FloodRunMode,
  FloodRunStatus,
} from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import { Checkbox } from '@/components/ui/checkbox'
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

const MODULES: Array<{
  code: FloodModule
  short: string
  name: string
  description: string
}> = [
  {
    code: 'event',
    short: 'M1',
    name: 'Hiện trạng ngập',
    description: 'Sentinel-1 trước/sau sự kiện',
  },
  { code: 'hand', short: 'M2', name: 'Nhạy cảm địa hình', description: 'HAND và độ dốc' },
  {
    code: 'impact',
    short: 'M4',
    name: 'Tác động ngập',
    description: 'Dân cư, công trình và hạ tầng',
  },
  {
    code: 'trend',
    short: 'M5',
    name: 'Xu thế nhiều năm',
    description: 'Tần suất, ngập mới, biến động đất',
  },
]

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


type FloodRunForm = Record<string, string | boolean>
type FloodConfigDefaults = Partial<Record<FloodModule, Record<string, unknown>>>

// Fallback values keep the form usable before GET /admin/flood/config returns.
// The server remains authoritative and supplies the current version after load.
const FORM_FALLBACK_DEFAULTS: Record<FloodModule, Record<string, unknown>> = {
  event: {
    preStart: '2024-01-01',
    preEnd: '2024-04-30',
    postStart: '2024-09-01',
    postEnd: '2024-09-30',
    runImpactAfterM1: true,
  },
  hand: { levelM: 5 },
  impact: { impactSource: 'M1', impactUseNonTidal: true },
  trend: {
    dryStart: '2023-01-01',
    dryEnd: '2023-04-30',
    periods: [
      { start: '2023-07-01', end: '2023-07-31' },
      { start: '2023-08-01', end: '2023-08-31' },
      { start: '2023-09-01', end: '2023-09-30' },
      { start: '2023-10-01', end: '2023-10-31' },
    ],
  },
}

function stringDefault(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function booleanDefault(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function periodDefault(value: unknown, index: number, key: 'start' | 'end') {
  if (!Array.isArray(value) || !value[index] || typeof value[index] !== 'object') return ''
  return stringDefault((value[index] as Record<string, unknown>)[key])
}

function createRunForm(module: FloodModule, defaults: Record<string, unknown> = {}): FloodRunForm {
  switch (module) {
    case 'event':
      return {
        preStart: stringDefault(defaults.preStart),
        preEnd: stringDefault(defaults.preEnd),
        postStart: stringDefault(defaults.postStart),
        postEnd: stringDefault(defaults.postEnd),
        runImpactAfterM1: booleanDefault(defaults.runImpactAfterM1, true),
      }
    case 'hand':
      return { levelM: stringDefault(defaults.levelM, '5') }
    case 'impact':
      return {
        impactSource: stringDefault(defaults.impactSource, 'M1'),
        sourceRunId: '',
        impactUseNonTidal: booleanDefault(defaults.impactUseNonTidal, true),
      }
    case 'trend':
      return {
        dryStart: stringDefault(defaults.dryStart),
        dryEnd: stringDefault(defaults.dryEnd),
        period1Start: periodDefault(defaults.periods, 0, 'start'),
        period1End: periodDefault(defaults.periods, 0, 'end'),
        period2Start: periodDefault(defaults.periods, 1, 'start'),
        period2End: periodDefault(defaults.periods, 1, 'end'),
        period3Start: periodDefault(defaults.periods, 2, 'start'),
        period3End: periodDefault(defaults.periods, 2, 'end'),
        period4Start: periodDefault(defaults.periods, 3, 'start'),
        period4End: periodDefault(defaults.periods, 3, 'end'),
      }
  }
}

function requiredFormValue(form: FloodRunForm, key: string, label: string) {
  const value = form[key]
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Hãy nhập ${label.toLowerCase()}.`)
  return value.trim()
}

function optionalNumber(form: FloodRunForm, key: string, label: string) {
  const value = form[key]
  if (typeof value !== 'string' || !value.trim()) return undefined
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${label} phải là một số hợp lệ.`)
  return number
}

function buildRunConfig(module: FloodModule, form: FloodRunForm): Record<string, unknown> {
  switch (module) {
    case 'event':
      return {
        preStart: requiredFormValue(form, 'preStart', 'ngày bắt đầu kỳ nền'),
        preEnd: requiredFormValue(form, 'preEnd', 'ngày kết thúc kỳ nền'),
        postStart: requiredFormValue(form, 'postStart', 'ngày bắt đầu kỳ phân tích'),
        postEnd: requiredFormValue(form, 'postEnd', 'ngày kết thúc kỳ phân tích'),
        runImpactAfterM1: form.runImpactAfterM1 === true,
      }
    case 'hand': {
      const levelM = optionalNumber(form, 'levelM', 'Mực nước giả định')
      return levelM === undefined ? {} : { levelM }
    }
    case 'impact': {
      const sourceRunId = optionalNumber(form, 'sourceRunId', 'Mã lượt chạy nguồn')
      return {
        impactSource: requiredFormValue(form, 'impactSource', 'nguồn lớp ngập'),
        impactUseNonTidal: form.impactUseNonTidal === true,
        ...(sourceRunId === undefined ? {} : { sourceRunId }),
      }
    }
    case 'trend': {
      const periods = [1, 2, 3, 4].map((index) => ({
        start: requiredFormValue(form, `period${index}Start`, `ngày bắt đầu đợt ${index}`),
        end: requiredFormValue(form, `period${index}End`, `ngày kết thúc đợt ${index}`),
      }))
      return {
        dryStart: requiredFormValue(form, 'dryStart', 'ngày bắt đầu kỳ nền'),
        dryEnd: requiredFormValue(form, 'dryEnd', 'ngày kết thúc kỳ nền'),
        periods,
      }
    }
  }
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

function moduleLabel(module: FloodModule) {
  const item = MODULES.find(({ code }) => code === module)
  return item ? `${item.name}` : module
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
  const [activeTab, setActiveTab] = useState('submit')
  const [module, setModule] = useState<FloodModule>('event')
  const [mode, setMode] = useState<FloodRunMode>('product')
  const [runForm, setRunForm] = useState<FloodRunForm>(() =>
    createRunForm('event', FORM_FALLBACK_DEFAULTS.event)
  )
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['flood'] })
  }

  // Poll only the lightweight queue/dashboard state. History is opt-in and is
  // fetched only while its collapsible panel is open.
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
      moduleFilter,
      statusFilter,
      fromFilter,
      toFilter,
    ],
    () =>
      floodService.getRuns({
        page: historyPage,
        limit: historyPageSize,
        module: moduleFilter === 'all' ? undefined : moduleFilter,
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
  // Config is version-stamped on the server and doesn't change on its own —
  // fetch once and let refreshAll invalidate it after a config-writing action.
  const configQuery = useApiQuery(['flood', 'config'], () => floodService.getConfig(), {}, false)
  const detailQuery = useApiQuery(
    ['flood', 'run', selectedRunId],
    () => floodService.getRun(selectedRunId as number),
    { enabled: activeTab === 'runs' && historyExpanded && selectedRunId != null },
    false
  )

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
        defaults?: FloodConfigDefaults
        versions?: Partial<Record<FloodModule, string>>
        configVersion?: string
        probabilityCalibrated?: boolean
      }
    | undefined
  const configDefaults = floodConfig?.defaults
  const layerCounts = useMemo(() => {
    const result = Object.fromEntries(MODULES.map(({ code }) => [code, 0]))
    dashboard?.layers?.forEach((layer) => {
      result[layer.module] = (result[layer.module] || 0) + 1
    })
    return result
  }, [dashboard])

  const updateRunForm = (key: string, value: string | boolean) => {
    setRunForm((current) => ({ ...current, [key]: value }))
  }

  const resetHistoryFilters = () => {
    setModuleFilter('all')
    setStatusFilter('all')
    setFromFilter('')
    setToFilter('')
    setHistoryPage(1)
    setSelectedRunId(null)
  }

  const hasHistoryFilters =
    moduleFilter !== 'all' || statusFilter !== 'all' || Boolean(fromFilter) || Boolean(toFilter)
  const refreshingPage =
    dashboardQuery.isFetching ||
    queueQuery.isFetching ||
    configQuery.isFetching ||
    (historyExpanded && runsQuery.isFetching)

  const selectModule = (value: string) => {
    const nextModule = value as FloodModule
    setModule(nextModule)
    setRunForm(
      createRunForm(nextModule, configDefaults?.[nextModule] ?? FORM_FALLBACK_DEFAULTS[nextModule])
    )
  }

  const submitRun = () => {
    try {
      const config = buildRunConfig(module, runForm)
      submitMutation.mutate({ module, mode, config })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Không thể đọc thông tin lượt phân tích.'
      )
      return
    }
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
        {canRun && (
          <ScenarioPresets
            onPickScenario={(scenarioModule) => {
              selectModule(scenarioModule)
              setActiveTab('submit')
            }}
          />
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {MODULES.map((item) => {
            const latest = dashboard?.modules?.[item.code]
            const publishedCount = layerCounts[item.code] || 0
            const clickable = canRun
            return (
              <Card
                key={item.code}
                className={cn(
                  'shadow-none transition',
                  clickable && 'cursor-pointer hover:border-sky-400 hover:shadow-sm'
                )}
                onClick={
                  clickable
                    ? () => {
                        selectModule(item.code)
                        setActiveTab('submit')
                      }
                    : undefined
                }
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{item.name}</CardTitle>
                    {latest ? (
                      <StatusBadge status={latest.status} />
                    ) : (
                      <Badge variant="outline">Trống</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground p-4 pt-1 text-xs">
                  <p className="flex items-center gap-1">
                    <Archive className="size-3" />
                    {publishedCount} lớp đã công bố
                  </p>
                  <p className="mt-1 flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatDateTime(latest?.finishedAt) || '—'}
                  </p>
                  {clickable && (
                    <p className="mt-2 text-[10px] text-sky-700">Bấm để tạo lượt chạy →</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <MetricCard
            icon={queue?.active ? Loader2 : CheckCircle2}
            label="Tiến trình đang chạy"
            value={queue?.active?.label || 'Không có'}
            hint={`Xử lý ${queue?.concurrency ?? 1} lượt cùng lúc`}
            spinning={Boolean(queue?.active)}
          />
          <MetricCard
            icon={Clock3}
            label="Đang chờ"
            value={String(queue?.pending?.length ?? 0)}
            hint={`Còn ${queue?.capacityRemaining ?? 0}/${queue?.maxPending ?? 0} vị trí`}
          />
          <MetricCard
            icon={Activity}
            label="Nhận tác vụ"
            value={queue?.accepting === false ? 'Đang dừng' : 'Sẵn sàng'}
            hint="Hàng đợi vệ tinh chung, xử lý tuần tự"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="runs">
              <span className="sm:hidden">Lịch sử</span>
              <span className="hidden sm:inline">Lịch sử chạy</span>
            </TabsTrigger>
            <TabsTrigger value="submit">
              <span className="sm:hidden">Tạo lượt</span>
              <span className="hidden sm:inline">Tạo lượt chạy</span>
            </TabsTrigger>
          </TabsList>

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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="history-module">Mô-đun</Label>
                          <Select
                            value={moduleFilter}
                            onValueChange={(next) => {
                              setModuleFilter(next)
                              setHistoryPage(1)
                              setSelectedRunId(null)
                            }}
                          >
                            <SelectTrigger id="history-module">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tất cả mô-đun</SelectItem>
                              {MODULES.map((item) => (
                                <SelectItem key={item.code} value={item.code}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

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
                          <TableHead>Mô-đun</TableHead>
                          <TableHead>Chế độ</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Thời gian</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runsQuery.isFetching && !runs.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center">
                              <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                                <Loader2 className="size-4 animate-spin" />
                                Đang tải lịch sử...
                              </span>
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {runs.map((run) => (
                          <TableRow
                            key={run.id}
                            data-state={selectedRunId === run.id ? 'selected' : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedRunId(run.id)}
                          >
                            <TableCell className="font-mono">
                              #{run.id}.{run.attempt_no}
                            </TableCell>
                            <TableCell>{moduleLabel(run.module)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {run.mode === 'product' ? 'Product' : 'Calibration'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={run.status} />
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
                        ))}
                        {!runs.length && !runsQuery.isFetching ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
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
              <>
                <ImpactMetricsCard runDetail={runDetail} />
                {/* <RunDetail
                  run={runDetail}
                  loading={detailQuery.isFetching}
                  canPublish={canPublish}
                  mutationPending={publishMutation.isPending}
                  onArtifactAction={(artifact, action) =>
                    publishMutation.mutate({ id: artifact.id, action })
                  }
                /> */}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="submit">
            <div className="grid w-full gap-4 lg:grid-cols-12">
              <Card className="min-w-0 lg:col-span-4 xl:col-span-3">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="size-5 text-sky-600" />
                    1. Chọn loại phân tích
                  </CardTitle>
                  <CardDescription>
                    Chọn tác vụ và mục đích chạy. Các ngưỡng khoa học được khóa theo phiên bản cấu
                    hình chuẩn để tránh thay đổi ngoài quy trình kiểm định.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="space-y-2">
                    <Label>Mô-đun</Label>
                    <Select value={module} onValueChange={selectModule}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODULES.map((item) => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      {MODULES.find((item) => item.code === module)?.description}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chế độ</Label>
                    <Select value={mode} onValueChange={(value) => setMode(value as FloodRunMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">
                          Sản phẩm · có thể công bố lên bản đồ
                        </SelectItem>
                        <SelectItem value="calibration" disabled={!canCalibrate}>
                          Hiệu chuẩn · chỉ lưu trữ, kiểm định chất lượng
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      {mode === 'product'
                        ? 'Kết quả đạt kiểm định có thể đưa vào quy trình công bố.'
                        : 'Dùng để kiểm định; kết quả không được công bố trực tiếp.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 lg:col-span-8 xl:col-span-9">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="size-5 text-sky-600" />
                    2. Nhập thông tin cần thiết
                  </CardTitle>
                  <CardDescription>
                    Các trường bên dưới thay thế JSON. Trường có dấu * là dữ liệu cần cho lượt chạy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <RunFormFields
                    module={module}
                    form={runForm}
                    configVersion={floodConfig?.configVersion}
                    onChange={updateRunForm}
                  />
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

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings2 className="size-5" />
                  Cấu hình đã phiên bản hóa
                </CardTitle>
                <CardDescription>
                  Thông số chuẩn do hệ thống kiểm soát. Chỉ cán bộ kỹ thuật cần xem chi tiết kỹ
                  thuật.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ConfigFact
                    label="Phiên bản cấu hình"
                    value={floodConfig?.configVersion || 'Đang tải'}
                  />
                  <ConfigFact
                    label="Mô hình M1"
                    value={floodConfig?.versions?.event || 'Đang tải'}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {MODULES.map((item) => (
                    <div key={item.code} className="rounded-lg border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {configExplanation(item.code, configDefaults?.[item.code])}
                      </p>
                      <Badge variant="outline" className="mt-3">
                        {floodConfig?.versions?.[item.code] || 'Phiên bản đang tải'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="bg-muted/30 text-muted-foreground rounded-lg border p-3 text-sm">
                  Tài liệu chi tiết dành cho cán bộ kỹ thuật:{' '}
                  <span className="text-foreground font-mono">
                    server/docs/FLOOD_MODEL_CONFIGURATION.md
                  </span>
                  .
                </p>
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium">
                    Xem dữ liệu kỹ thuật (JSON)
                  </summary>
                  <pre className="bg-muted/30 mt-3 max-h-[28rem] overflow-auto rounded-md p-4 text-xs">
                    {JSON.stringify(floodConfig ?? {}, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function RunFormFields({
  module,
  form,
  configVersion,
  onChange,
}: {
  module: FloodModule
  form: FloodRunForm
  configVersion?: string
  onChange: (key: string, value: string | boolean) => void
}) {
  const value = (key: string) => (typeof form[key] === 'string' ? (form[key] as string) : '')
  const dateField = (key: string, label: string, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="date"
        value={value(key)}
        onChange={(event) => onChange(key, event.target.value)}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
  const numberField = (key: string, label: string, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min="0"
        step="any"
        value={value(key)}
        onChange={(event) => onChange(key, event.target.value)}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )

  if (module === 'event') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-sm">
          Chọn kỳ nền trước sự kiện và kỳ cần phân tích sau sự kiện. Hệ thống sẽ so sánh ảnh
          Sentinel-1 giữa hai kỳ.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {dateField('preStart', 'Kỳ nền — từ ngày *')}
          {dateField('preEnd', 'Kỳ nền — đến ngày *')}
          {dateField('postStart', 'Kỳ phân tích — từ ngày *')}
          {dateField('postEnd', 'Kỳ phân tích — đến ngày *')}
        </div>
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id="runImpactAfterM1"
            checked={form.runImpactAfterM1 === true}
            onCheckedChange={(checked) => onChange('runImpactAfterM1', checked === true)}
          />
          <div>
            <Label htmlFor="runImpactAfterM1" className="cursor-pointer">
              Tính tác động sau khi có kết quả M1
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Tự tạo phần thống kê dân cư, công trình và hạ tầng có thể bị ảnh hưởng.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (module === 'hand') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-sm">
          Mô phỏng vùng nhạy cảm ngập theo địa hình. Chỉ cần nhập mực nước giả định cho kịch bản
          này.
        </div>
        <div className="max-w-sm">
          {numberField(
            'levelM',
            'Mực nước giả định (m)',
            'Giá trị đề xuất là 5 m. Hệ thống tự áp dụng giới hạn độ dốc an toàn.'
          )}
        </div>
      </div>
    )
  }

  if (module === 'impact') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-sm">
          Thống kê tác động từ lớp ngập có sẵn. Nếu không chỉ định mã lượt chạy, hệ thống chọn kết
          quả phù hợp gần nhất.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nguồn lớp ngập</Label>
            <Select
              value={value('impactSource') || 'M1'}
              onValueChange={(next) => onChange('impactSource', next)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M1">M1 · Hiện trạng ngập</SelectItem>
                <SelectItem value="M2">M2 · Kịch bản địa hình</SelectItem>
                <SelectItem value="M3">M3 · Chỉ số nguy cơ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceRunId">
              Mã lượt chạy nguồn <span className="text-muted-foreground">(không bắt buộc)</span>
            </Label>
            <Input
              id="sourceRunId"
              type="number"
              min="1"
              step="1"
              value={value('sourceRunId')}
              onChange={(event) => onChange('sourceRunId', event.target.value)}
              placeholder="Ví dụ: 125"
            />
            <p className="text-muted-foreground text-xs">
              Dùng khi cần tính tác động cho một lượt cụ thể.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id="impactUseNonTidal"
            checked={form.impactUseNonTidal === true}
            onCheckedChange={(checked) => onChange('impactUseNonTidal', checked === true)}
          />
          <div>
            <Label htmlFor="impactUseNonTidal" className="cursor-pointer">
              Loại trừ khu vực chịu ảnh hưởng thủy triều
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Khuyến nghị dùng để thống kê vùng ngập chính xác hơn.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-sm">
        So sánh một kỳ nền khô với bốn đợt mưa/ngập. Các ngưỡng phân loại và kiểm định được dùng
        theo cấu hình chuẩn.
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Kỳ nền khô *</p>
        <div className="grid gap-4 md:grid-cols-2">
          {dateField('dryStart', 'Từ ngày')}
          {dateField('dryEnd', 'Đến ngày')}
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Các đợt phân tích *</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              {dateField(`period${index}Start`, `Đợt ${index} — từ ngày`)}
              {dateField(`period${index}End`, `Đợt ${index} — đến ngày`)}
            </div>
          ))}
        </div>
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

function configExplanation(module: FloodModule, defaults?: Record<string, unknown>) {
  switch (module) {
    case 'event':
      return `So sánh ảnh Sentinel-1; ngưỡng ${stringDefault(defaults?.thresholdMode, 'chuẩn')} và giới hạn dốc ${stringDefault(defaults?.hardMaximumSlope, '—')}°.`
    case 'hand':
      return `Kịch bản mực nước ${stringDefault(defaults?.levelM, '—')} m; giới hạn dốc ${stringDefault(defaults?.maximumSlope, '—')}°.`
    case 'rain':
      return `Nguồn mặc định ${stringDefault(defaults?.source, '—')}; ngưỡng cảnh báo ${stringDefault(defaults?.threshold, '—')}.`
    case 'impact':
      return `Thống kê dựa trên ${stringDefault(defaults?.impactSource, '—')}; ${defaults?.impactUseNonTidal === true ? 'có' : 'không'} loại trừ thủy triều.`
    case 'trend':
      return `Theo dõi ${Array.isArray(defaults?.periods) ? defaults.periods.length : '—'} đợt; ngưỡng tần suất ${stringDefault(defaults?.frequencyAlertPercent, '—')}%.`
  }
}

// function RunDetail({
//   run,
//   loading,
//   canPublish,
//   mutationPending,
//   onArtifactAction,
// }: {
//   run: FloodRunDetail | undefined
//   loading: boolean
//   canPublish: boolean
//   mutationPending: boolean
//   onArtifactAction: (artifact: FloodArtifact, action: 'publish' | 'unpublish') => void
// }) {
//   const [previewArtifactId, setPreviewArtifactId] = useState<number | null>(null)
//   const previewableArtifacts = (run?.artifacts || []).filter(
//     (artifact) => artifact.publish_status === 'published' && Number(artifact.registry_layer_id) > 0
//   )
//   const previewArtifact =
//     previewableArtifacts.find((artifact) => artifact.id === previewArtifactId) ||
//     previewableArtifacts[0]

//   if (loading && !run)
//     return (
//       <Card>
//         <CardContent className="flex items-center gap-2 p-6">
//           <Loader2 className="animate-spin" />
//           Đang tải chi tiết...
//         </CardContent>
//       </Card>
//     )
//   if (!run) return null
//   return (
//     <Card>
//       <CardHeader>
//         <div className="flex flex-wrap items-center justify-between gap-2">
//           <div>
//             <CardTitle className="text-lg">Chi tiết lượt chạy #{run.id}</CardTitle>
//             <CardDescription>
//               {moduleLabel(run.module)} · {run.pipeline_version}
//             </CardDescription>
//           </div>
//           <StatusBadge status={run.status} />
//         </div>
//       </CardHeader>
//       <CardContent className="space-y-5">
//         {run.error_message_safe ? (
//           <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
//             <AlertTriangle className="mt-0.5 size-4 shrink-0" />
//             <span>
//               {run.error_code ? `${run.error_code}: ` : ''}
//               {run.error_message_safe}
//             </span>
//           </div>
//         ) : null}
//         <div>
//           <h3 className="mb-2 font-medium">Giai đoạn xử lý</h3>
//           <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
//             {(run.stages || []).map((stage: FloodStageEvent) => (
//               <div key={stage.id} className="rounded-md border p-3 text-sm">
//                 <p className="font-medium">
//                   {stage.stage} · {stage.event_type}
//                 </p>
//                 <p className="text-muted-foreground mt-1 text-xs">
//                   {stage.elapsed_ms != null
//                     ? `${stage.elapsed_ms} ms`
//                     : formatDateTime(stage.emitted_at)}
//                 </p>
//               </div>
//             ))}
//             {!run.stages?.length ? (
//               <p className="text-muted-foreground text-sm">Chưa có sự kiện giai đoạn.</p>
//             ) : null}
//           </div>
//         </div>
//         <div>
//           <h3 className="mb-2 font-medium">Sản phẩm và trạng thái công bố</h3>
//           <div className="space-y-2">
//             {(run.artifacts || []).map((artifact: FloodArtifact) => (
//               <div
//                 key={artifact.id}
//                 className="flex flex-col gap-3 rounded-md border p-3 lg:flex-row lg:items-center lg:justify-between"
//               >
//                 <div className="min-w-0">
//                   <div className="flex flex-wrap items-center gap-2">
//                     <p className="font-medium">
//                       {artifact.metadata?.label?.vi || artifact.artifact_code}
//                     </p>
//                     <Badge variant="outline">
//                       {ARTIFACT_ROLE_LABELS[artifact.artifact_role] || artifact.artifact_role}
//                     </Badge>
//                     <Badge
//                       variant={artifact.publish_status === 'failed' ? 'destructive' : 'secondary'}
//                     >
//                       {PUBLISH_STATUS_LABELS[artifact.publish_status] || artifact.publish_status}
//                     </Badge>
//                   </div>
//                   <p className="text-muted-foreground mt-1 truncate text-xs">
//                     {artifact.publish_status === 'published'
//                       ? 'Đã công bố lên bản đồ'
//                       : artifact.minio_object_key
//                         ? 'Đã lưu trữ, sẵn sàng công bố'
//                         : 'Chưa có dữ liệu lưu trữ'}
//                     {artifact.resolution_m ? ` · độ phân giải ${artifact.resolution_m} m` : ''}
//                   </p>
//                 </div>
//                 <div className="flex shrink-0 flex-wrap gap-2">
//                   {artifact.publish_status === 'published' &&
//                   Number(artifact.registry_layer_id) > 0 ? (
//                     <Button
//                       size="sm"
//                       variant={previewArtifact?.id === artifact.id ? 'default' : 'outline'}
//                       onClick={() => setPreviewArtifactId(artifact.id)}
//                     >
//                       <MapIcon />
//                       Xem trên bản đồ
//                     </Button>
//                   ) : null}
//                   {canPublish ? (
//                     <>
//                       {artifact.publish_status === 'published' ? (
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           disabled={mutationPending}
//                           onClick={() => {
//                             if (window.confirm(`Gỡ công bố sản phẩm này khỏi bản đồ?`))
//                               onArtifactAction(artifact, 'unpublish')
//                           }}
//                         >
//                           <Archive />
//                           Gỡ công bố
//                         </Button>
//                       ) : artifact.artifact_role !== 'CALIBRATION' && artifact.minio_object_key ? (
//                         <Button
//                           size="sm"
//                           disabled={mutationPending}
//                           onClick={() => onArtifactAction(artifact, 'publish')}
//                         >
//                           <CloudUpload />
//                           {artifact.publish_status === 'failed' ? 'Thử lại' : 'Công bố'}
//                         </Button>
//                       ) : null}
//                     </>
//                   ) : null}
//                 </div>
//               </div>
//             ))}
//             {!run.artifacts?.length ? (
//               <p className="text-muted-foreground text-sm">Chưa có sản phẩm.</p>
//             ) : null}
//           </div>
//         </div>
//         {previewArtifact ? (
//           <div className="space-y-2">
//             <div>
//               <h3 className="font-medium">Bản xem trước lớp đã công bố</h3>
//               <p className="text-muted-foreground mt-1 text-xs">
//                 {previewArtifact.metadata?.label?.vi || previewArtifact.artifact_code}
//               </p>
//             </div>
//             <FloodRasterPreview
//               key={`${previewArtifact.registry_layer_id}-${previewArtifact.registry_is_public}`}
//               layerId={previewArtifact.registry_layer_id as number | string}
//               isPublic={previewArtifact.registry_is_public === true}
//             />
//           </div>
//         ) : null}
//       </CardContent>
//     </Card>
//   )
// }

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

/**
 * Read-only OpenWeather reference for the M3 manual rainfall form.
 * The current-weather endpoint only reports rain over the last hour at one
 * point. It must not be copied into a 3h accumulated-rainfall field because
 * those measurements cover different time windows.
 */
function OpenWeatherReference() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<{
    observedAt: string | null
    location: string | null
    rain1h: number
    humidity: number | null
    windSpeed: number | null
  } | null>(null)

  const fetchNow = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await floodService.getCurrentWeather()
      const data = res?.data
      setSnapshot({
        observedAt: data?.observedAt ?? null,
        location: data?.location ?? null,
        rain1h: Number(data?.rainfall?.amount1h || 0),
        humidity: data?.humidity ?? null,
        windSpeed: data?.wind?.speed ?? null,
      })
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } } | null)?.body?.message ||
        (err as Error)?.message ||
        'Không lấy được dữ liệu OpenWeather.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-md bg-white p-2 text-sky-700 shadow-sm">
            <CloudRain className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sky-950">Quan trắc OpenWeather</p>
              <Badge variant="outline" className="border-sky-300 bg-white text-sky-800">
                Tham khảo · 1 giờ
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-sky-900">
              Xem nhanh thời tiết hiện tại tại điểm trung tâm Cẩm Phả. Dữ liệu này không tự động
              được đưa vào lượt chạy M3.
            </p>
          </div>
        </div>
        <Button
          className="w-full shrink-0 bg-white sm:w-auto"
          size="sm"
          variant="outline"
          onClick={fetchNow}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          {loading ? 'Đang lấy...' : snapshot ? 'Cập nhật quan trắc' : 'Xem quan trắc hiện tại'}
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-md bg-white/80 p-2 text-xs text-sky-950">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        API thời tiết hiện tại chỉ trả tổng mưa 1 giờ tại một điểm; không cung cấp các tổng tích lũy
        3h, 6h, 24h, 72h, 7 ngày hoặc 30 ngày.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {snapshot && !error ? (
        <div className="mt-3 space-y-3" aria-live="polite">
          <div className="flex flex-col gap-1 text-xs text-sky-950 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="size-3.5" />
              {snapshot.location || 'Cẩm Phả'}
            </span>
            <span className="text-sky-800">
              Quan trắc lúc {formatDateTime(snapshot.observedAt)}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <WeatherFact
              icon={Droplets}
              label="Mưa 1 giờ"
              value={`${snapshot.rain1h.toFixed(2)} mm`}
            />
            <WeatherFact
              icon={CloudRain}
              label="Độ ẩm"
              value={snapshot.humidity == null ? 'Không có dữ liệu' : `${snapshot.humidity}%`}
            />
            <WeatherFact
              icon={Wind}
              label="Tốc độ gió"
              value={snapshot.windSpeed == null ? 'Không có dữ liệu' : `${snapshot.windSpeed} m/s`}
            />
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
            Không dùng trực tiếp mưa 1h thay cho tổng mưa 3h. Hãy nhập số liệu tích lũy đúng khoảng
            thời gian từ trạm đo hoặc nguồn nghiệp vụ đã kiểm tra.
          </p>
        </div>
      ) : null}
    </aside>
  )
}

function WeatherFact({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border border-sky-100 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs text-sky-800">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-sky-950">{value}</p>
    </div>
  )
}

/**
 * Preset scenario buttons — one click preps the run form for a common
 * operational case. Instead of forcing users to remember which module to pick,
 * we suggest the module + jump to the submit tab with fields pre-filled from
 * server defaults.
 */
function ScenarioPresets({ onPickScenario }: { onPickScenario: (module: FloodModule) => void }) {
  const scenarios: Array<{
    key: string
    icon: ComponentType<{ className?: string }>
    title: string
    description: string
    module: FloodModule
    tone: string
  }> = [
    {
      key: 'storm',
      icon: Waves,
      title: 'Bão vừa qua',
      description: 'Phát hiện ngập từ ảnh Sentinel-1 sau bão. Kèm thống kê tác động.',
      module: 'event',
      tone: 'border-sky-200 bg-sky-50 hover:border-sky-400',
    },
    {
      key: 'rain',
      icon: CloudRain,
      title: 'Mưa lớn dự báo',
      description: 'Chỉ số nguy cơ ngập theo lượng mưa IMERG / nhập thủ công.',
      module: 'rain',
      tone: 'border-indigo-200 bg-indigo-50 hover:border-indigo-400',
    },
    {
      key: 'scenario',
      icon: Droplets,
      title: 'Kịch bản mực nước',
      description: 'Vùng bị ngập giả định theo HAND + slope. Không cần ảnh sự kiện.',
      module: 'hand',
      tone: 'border-amber-200 bg-amber-50 hover:border-amber-400',
    },
    {
      key: 'trend',
      icon: Activity,
      title: 'Xu thế nhiều năm',
      description: 'Tần suất, ngập mới, biến động sử dụng đất qua nhiều mùa mưa.',
      module: 'trend',
      tone: 'border-emerald-200 bg-emerald-50 hover:border-emerald-400',
    },
  ]
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
        Bắt đầu nhanh theo tình huống
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onPickScenario(s.module)}
            className={cn(
              'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition',
              s.tone
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <s.icon className="size-4" />
              {s.title}
            </div>
            <p className="text-muted-foreground text-xs leading-snug">{s.description}</p>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Sẽ dùng mô-đun{' '}
              <span className="font-mono text-slate-700">
                {MODULES.find((m) => m.code === s.module)?.name}
              </span>
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * M4 impact metrics card. M4 doesn't publish rasters (impact is a metrics
 * bundle) — surface the numbers as top-level cards so operators see something
 * useful instead of "0 artifacts published".
 */
export function ImpactMetricsCard({ runDetail }: { runDetail: FloodRunDetail | undefined }) {
  const metadata =
    (runDetail?.result_metadata as
      | {
          affectedPopulation?: number
          affectedCroplandHa?: number
          affectedBuiltUpHa?: number
          landcoverBreakdown?: Record<string, number>
        }
      | undefined) || {}
  const hasAny =
    metadata.affectedPopulation != null ||
    metadata.affectedCroplandHa != null ||
    metadata.affectedBuiltUpHa != null
  if (!runDetail || runDetail.module !== 'impact' || !hasAny) {
    return null
  }
  const fmtNumber = (value: number | null | undefined, unit: string) =>
    value == null || Number.isNaN(Number(value))
      ? '—'
      : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${unit}`
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-rose-600" /> Tác động ngập (M4)
        </CardTitle>
        <CardDescription>Thống kê không phát hành raster, chỉ số liệu.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Dân số ước tính bị ảnh hưởng</div>
          <div className="mt-1 text-lg font-semibold">
            {fmtNumber(metadata.affectedPopulation, 'người')}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Đất nông nghiệp</div>
          <div className="mt-1 text-lg font-semibold">
            {fmtNumber(metadata.affectedCroplandHa, 'ha')}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Khu xây dựng</div>
          <div className="mt-1 text-lg font-semibold">
            {fmtNumber(metadata.affectedBuiltUpHa, 'ha')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
