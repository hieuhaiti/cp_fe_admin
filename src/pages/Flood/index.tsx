import { useMemo, useState, type ComponentType } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  Activity,
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  Clock3,
  CloudUpload,
  Loader2,
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
  FloodArtifact,
  FloodModule,
  FloodRunDetail,
  FloodRunMode,
  FloodRunStatus,
  FloodStageEvent,
} from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
  { code: 'event', short: 'M1', name: 'Hiện trạng ngập', description: 'Sentinel-1 trước/sau sự kiện' },
  { code: 'hand', short: 'M2', name: 'Nhạy cảm địa hình', description: 'HAND và độ dốc' },
  { code: 'rain', short: 'M3', name: 'Chỉ số nguy cơ', description: 'Chỉ số tương đối, không phải xác suất' },
  { code: 'impact', short: 'M4', name: 'Tác động ngập', description: 'Dân cư, công trình và hạ tầng' },
  { code: 'trend', short: 'M5', name: 'Xu thế nhiều năm', description: 'Tần suất, ngập mới, biến động đất' },
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

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('vi-VN')
}

function moduleLabel(module: FloodModule) {
  const item = MODULES.find(({ code }) => code === module)
  return item ? `${item.short} · ${item.name}` : module
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
  return <Badge variant="outline" className={tone}>{STATUS_LABELS[status] || status}</Badge>
}

export default function FloodPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canRun = hasPerm(user, 'flood', 'run')
  const canCalibrate = hasPerm(user, 'flood', 'calibrate')
  const canPublish = hasPerm(user, 'flood', 'publish')
  const [module, setModule] = useState<FloodModule>('event')
  const [mode, setMode] = useState<FloodRunMode>('product')
  const [configText, setConfigText] = useState('{}')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['flood'] })
  }

  const dashboardQuery = useApiQuery(
    ['flood', 'dashboard'],
    () => floodService.getDashboard(),
    { refetchInterval: 10_000 },
    false
  )
  const queueQuery = useApiQuery(
    ['flood', 'queue'],
    () => floodService.getQueue(),
    { refetchInterval: 5_000 },
    false
  )
  const configQuery = useApiQuery(['flood', 'config'], () => floodService.getConfig(), {}, false)
  const runsQuery = useApiQuery(
    ['flood', 'runs', moduleFilter, statusFilter],
    () => floodService.getRuns({
      page: 1,
      limit: 50,
      module: moduleFilter === 'all' ? undefined : moduleFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    { refetchInterval: 5_000 },
    false
  )
  const detailQuery = useApiQuery(
    ['flood', 'run', selectedRunId],
    () => floodService.getRun(selectedRunId as number),
    { enabled: selectedRunId != null, refetchInterval: 5_000 },
    false
  )

  const submitMutation = useApiMutation(
    (payload: { module: FloodModule; mode: FloodRunMode; config: Record<string, unknown> }) =>
      floodService.submit(payload),
    { onSuccess: () => refreshAll() }
  )
  const rerunMutation = useApiMutation(
    (id: number) => floodService.rerun(id),
    { onSuccess: () => refreshAll() }
  )
  const cancelMutation = useApiMutation(
    (id: number) => floodService.cancel(id),
    { onSuccess: () => refreshAll() }
  )
  const publishMutation = useApiMutation(
    ({ id, action }: { id: number; action: 'publish' | 'unpublish' }) =>
      action === 'publish'
        ? floodService.publishArtifact(id)
        : floodService.unpublishArtifact(id),
    { onSuccess: () => refreshAll() }
  )

  const runs = runsQuery.data?.data?.items ?? []
  const dashboard = dashboardQuery.data?.data
  const queue = queueQuery.data?.data
  const runDetail = detailQuery.data?.data
  const layerCounts = useMemo(() => {
    const result = Object.fromEntries(MODULES.map(({ code }) => [code, 0]))
    dashboard?.layers?.forEach((layer) => { result[layer.module] = (result[layer.module] || 0) + 1 })
    return result
  }, [dashboard])

  const submitRun = () => {
    let config: Record<string, unknown>
    try {
      const value = JSON.parse(configText)
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error()
      config = value
    } catch {
      toast.error('Cấu hình phải là một JSON object hợp lệ.')
      return
    }
    submitMutation.mutate({ module, mode, config })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b p-6 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <Waves className="size-6 text-sky-600" />
              <h1 className="text-2xl font-bold">Ngập lụt và thủy văn Cẩm Phả</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Vận hành M1–M5, theo dõi hàng đợi đơn luồng, kiểm tra sản phẩm và quản lý công bố GeoServer.
            </p>
          </div>
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCcw className={cn('size-4', runsQuery.isFetching && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <b>M3 là chỉ số nguy cơ tương đối, không phải xác suất.</b> Sản phẩm QA không thay thế kiểm tra hiện trường. Artifact calibration chỉ được lưu trữ, không được công bố trực tiếp.
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {MODULES.map((item) => {
            const latest = dashboard?.modules?.[item.code]
            return (
              <Card key={item.code} className="shadow-none">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{item.short} · {item.name}</CardTitle>
                    {latest ? <StatusBadge status={latest.status} /> : <Badge variant="outline">Trống</Badge>}
                  </div>
                  <CardDescription className="text-xs">{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
                  <p>{layerCounts[item.code] || 0} lớp đã công bố</p>
                  <p className="mt-1">{formatDateTime(latest?.finishedAt)}</p>
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
            hint={`Concurrency ${queue?.concurrency ?? 1}`}
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
            hint="GEE queue dùng chung, xử lý tuần tự"
          />
        </div>

        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="runs">Lịch sử chạy</TabsTrigger>
            <TabsTrigger value="submit">Tạo lượt chạy</TabsTrigger>
            <TabsTrigger value="config">Cấu hình</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Lịch sử vận hành</CardTitle>
                <CardDescription>Chọn một dòng để xem giai đoạn và artifact.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger><SelectValue placeholder="Mô-đun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả mô-đun</SelectItem>
                      {MODULES.map((item) => <SelectItem key={item.code} value={item.code}>{item.short} · {item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
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
                    {runs.map((run) => (
                      <TableRow
                        key={run.id}
                        data-state={selectedRunId === run.id ? 'selected' : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <TableCell className="font-mono">#{run.id}.{run.attempt_no}</TableCell>
                        <TableCell>{moduleLabel(run.module)}</TableCell>
                        <TableCell><Badge variant="outline">{run.mode === 'product' ? 'Product' : 'Calibration'}</Badge></TableCell>
                        <TableCell><StatusBadge status={run.status} /></TableCell>
                        <TableCell>{formatDateTime(run.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            {canRun && LIVE_STATUSES.has(run.status) ? (
                              <Button size="icon-xs" variant="destructive" title="Hủy" onClick={() => {
                                if (window.confirm(`Hủy lượt chạy #${run.id}?`)) cancelMutation.mutate(run.id)
                              }}><Ban /></Button>
                            ) : null}
                            {canRun && !LIVE_STATUSES.has(run.status) ? (
                              <Button size="icon-xs" variant="outline" title="Chạy lại" onClick={() => rerunMutation.mutate(run.id)}><RotateCcw /></Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!runs.length && !runsQuery.isFetching ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có lượt chạy phù hợp.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedRunId ? (
              <RunDetail
                run={runDetail}
                loading={detailQuery.isFetching}
                canPublish={canPublish}
                mutationPending={publishMutation.isPending}
                onArtifactAction={(artifact, action) => publishMutation.mutate({ id: artifact.id, action })}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="submit">
            <Card className="max-w-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Play className="size-5 text-sky-600" />Tạo lượt phân tích</CardTitle>
                <CardDescription>Server tự áp dụng defaults đã phiên bản hóa; JSON chỉ dùng để ghi đè tham số cần thiết.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Mô-đun</Label>
                    <Select value={module} onValueChange={(value) => setModule(value as FloodModule)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MODULES.map((item) => <SelectItem key={item.code} value={item.code}>{item.short} · {item.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Chế độ</Label>
                    <Select value={mode} onValueChange={(value) => setMode(value as FloodRunMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Product · có thể công bố</SelectItem>
                        <SelectItem value="calibration" disabled={!canCalibrate}>Calibration · chỉ lưu trữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flood-config">Cấu hình JSON</Label>
                  <Textarea id="flood-config" rows={12} value={configText} onChange={(event) => setConfigText(event.target.value)} className="font-mono text-xs" spellCheck={false} />
                </div>
                <Button onClick={submitRun} disabled={!canRun || submitMutation.isPending}>
                  {submitMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                  {submitMutation.isPending ? 'Đang gửi...' : 'Đưa vào hàng đợi'}
                </Button>
                {!canRun ? <p className="text-sm text-muted-foreground">Tài khoản hiện tại chỉ có quyền xem.</p> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="size-5" />Cấu hình đã phiên bản hóa</CardTitle>
                <CardDescription>Đọc trực tiếp từ server; không chứa khóa dịch vụ hoặc bí mật vận hành.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[32rem] overflow-auto rounded-md border bg-muted/30 p-4 text-xs">{JSON.stringify(configQuery.data?.data ?? {}, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function RunDetail({
  run,
  loading,
  canPublish,
  mutationPending,
  onArtifactAction,
}: {
  run: FloodRunDetail | undefined
  loading: boolean
  canPublish: boolean
  mutationPending: boolean
  onArtifactAction: (artifact: FloodArtifact, action: 'publish' | 'unpublish') => void
}) {
  if (loading && !run) return <Card><CardContent className="flex items-center gap-2 p-6"><Loader2 className="animate-spin" />Đang tải chi tiết...</CardContent></Card>
  if (!run) return null
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Chi tiết lượt chạy #{run.id}</CardTitle>
            <CardDescription>{moduleLabel(run.module)} · {run.pipeline_version}</CardDescription>
          </div>
          <StatusBadge status={run.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {run.error_message_safe ? (
          <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{run.error_code ? `${run.error_code}: ` : ''}{run.error_message_safe}</span>
          </div>
        ) : null}
        <div>
          <h3 className="mb-2 font-medium">Giai đoạn xử lý</h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(run.stages || []).map((stage: FloodStageEvent) => (
              <div key={stage.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{stage.stage} · {stage.event_type}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stage.elapsed_ms != null ? `${stage.elapsed_ms} ms` : formatDateTime(stage.emitted_at)}</p>
              </div>
            ))}
            {!run.stages?.length ? <p className="text-sm text-muted-foreground">Chưa có sự kiện giai đoạn.</p> : null}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-medium">Artifact và công bố</h3>
          <div className="space-y-2">
            {(run.artifacts || []).map((artifact: FloodArtifact) => (
              <div key={artifact.id} className="flex flex-col gap-3 rounded-md border p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{artifact.metadata?.label?.vi || artifact.artifact_code}</p>
                    <Badge variant="outline">{artifact.artifact_role}</Badge>
                    <Badge variant={artifact.publish_status === 'failed' ? 'destructive' : 'secondary'}>{artifact.publish_status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {artifact.workspace && artifact.layer_name ? `${artifact.workspace}:${artifact.layer_name}` : artifact.minio_object_key || 'Chưa có kho lưu trữ'}
                    {artifact.resolution_m ? ` · ${artifact.resolution_m} m` : ''}
                  </p>
                </div>
                {canPublish ? (
                  <div className="flex shrink-0 gap-2">
                    {artifact.publish_status === 'published' ? (
                      <Button size="sm" variant="outline" disabled={mutationPending} onClick={() => {
                        if (window.confirm(`Gỡ công bố artifact #${artifact.id}?`)) onArtifactAction(artifact, 'unpublish')
                      }}><Archive />Gỡ công bố</Button>
                    ) : artifact.artifact_role !== 'CALIBRATION' && artifact.minio_object_key ? (
                      <Button size="sm" disabled={mutationPending} onClick={() => onArtifactAction(artifact, 'publish')}><CloudUpload />{artifact.publish_status === 'failed' ? 'Thử lại' : 'Công bố'}</Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {!run.artifacts?.length ? <p className="text-sm text-muted-foreground">Chưa có artifact.</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={cn('size-4', spinning && 'animate-spin')} />{label}</div>
        <p className="mt-2 truncate text-lg font-semibold" title={value}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
