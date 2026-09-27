import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Activity,
  AlertCircle,
  Ban,
  Copy,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { mapLayerApiService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, MapApiKey, MapApiKeyIssueData, MapApiUsageData, MapLayerApi } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { ACTIVE_CLASS, ACTIVE_DOT, ACTIVE_LABEL } from '@/constant/mapLayerConstant'
import IssueKeyDialog from '@/components/map-layer-apis/IssueKeyDialog'
import TokenIssuedModal from '@/components/map-layer-apis/TokenIssuedModal'

interface MapLayerApiDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiId: number | null
}

function getKeyItems(data: unknown): MapApiKey[] {
  const res = data as ApiResponse<MapApiKey[] | { items?: MapApiKey[] }> | undefined
  const payload = res?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export default function MapLayerApiDetailDialog({
  open,
  onOpenChange,
  apiId,
}: MapLayerApiDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<'keys' | 'config' | 'usage'>('keys')
  const [issueKeyOpen, setIssueKeyOpen] = useState(false)
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [issuedTokenData, setIssuedTokenData] = useState<MapApiKeyIssueData | null>(null)
  const [isRotation, setIsRotation] = useState(false)

  const [keyToRotate, setKeyToRotate] = useState<MapApiKey | null>(null)
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<MapApiKey | null>(null)
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)

  // 1. Fetch registry detail
  const detailQuery = useApiQuery(
    ['mapLayerApiDetailDialog', apiId],
    () => mapLayerApiService.getById(apiId!),
    { enabled: !!apiId && open, staleTime: 0 },
    false,
    false
  )

  // 2. Fetch keys list for this registry
  const keysQuery = useApiQuery(
    ['mapLayerApiKeys', apiId],
    () => mapLayerApiService.getKeys(apiId!),
    { enabled: !!apiId && open, staleTime: 0 },
    false,
    false
  )

  // 3. Fetch usage stats
  const usageQuery = useApiQuery(
    ['mapLayerApiUsage', apiId],
    () => mapLayerApiService.getUsage(apiId!),
    { enabled: !!apiId && open, staleTime: 0 },
    false,
    false
  )

  const api = useMemo(() => {
    const data = (detailQuery.data as ApiResponse<any> | undefined)?.data
    return (data ? (data.api ?? data) : null) as MapLayerApi | null
  }, [detailQuery.data])

  const keys = useMemo(() => getKeyItems(keysQuery.data), [keysQuery.data])
  const keyMap = useMemo(() => {
    const map = new Map<string, MapApiKey>()
    keys.forEach((k) => {
      if (k.id) map.set(k.id, k)
    })
    return map
  }, [keys])
  const usage = (usageQuery.data as ApiResponse<MapApiUsageData> | undefined)?.data

  // Rotate Key Mutation
  const rotateMutation = useApiMutation(
    (keyId: string) => mapLayerApiService.rotateKey(keyId, 720),
    {
      onSuccess: (res: ApiResponse<MapApiKeyIssueData>) => {
        toast.success('Xoay khóa thành công!')
        setRotateConfirmOpen(false)
        setKeyToRotate(null)
        keysQuery.refetch()
        if (res.data) {
          setIsRotation(true)
          setIssuedTokenData(res.data)
          setTokenModalOpen(true)
        }
      },
      onError: (err) => {
        toast.error(getMappedErrorMessage(err, 'Không thể xoay khóa'))
      },
    },
    false
  )

  // Revoke Key Mutation
  const revokeMutation = useApiMutation(
    (keyId: string) => mapLayerApiService.revokeKey(keyId),
    {
      onSuccess: () => {
        toast.success('Đã thu hồi khóa thành công')
        setRevokeConfirmOpen(false)
        setKeyToRevoke(null)
        keysQuery.refetch()
      },
      onError: (err) => {
        toast.error(getMappedErrorMessage(err, 'Không thể thu hồi khóa'))
      },
    },
    false
  )

  const handleCopyEndpoint = async () => {
    if (!api?.slug) return
    const url = `https://apicampha.tourismpj.pro.vn/api/v1/shared/${api.slug}/features`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã sao chép đường dẫn API')
    } catch {
      toast.error('Không thể sao chép')
    }
  }

  const handleOpenRotate = (k: MapApiKey) => {
    setKeyToRotate(k)
    setRotateConfirmOpen(true)
  }

  const handleOpenRevoke = (k: MapApiKey) => {
    setKeyToRevoke(k)
    setRevokeConfirmOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold">
                      {api?.name || 'Chi tiết API lớp bản đồ'}
                    </DialogTitle>
                    {api && (
                      <StatusDotBadge
                        label={ACTIVE_LABEL[String(api.is_active)]}
                        badgeClass={ACTIVE_CLASS[String(api.is_active)]}
                        dotClass={ACTIVE_DOT[String(api.is_active)]}
                      />
                    )}
                  </div>
                  <DialogDescription className="mt-0.5 text-xs">
                    Lớp:{' '}
                    <strong className="text-foreground">
                      {api?.layer_name || api?.layer_name_vi || api?.layer_code || '-'}
                    </strong>
                    {api?.layer_code && (
                      <span className="text-muted-foreground ml-1 font-mono">({api.layer_code})</span>
                    )}
                  </DialogDescription>
                </div>
              </div>

              {api?.slug && (
                <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-mono">
                    /api/v1/shared/{api.slug}/features
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleCopyEndpoint}
                        className="h-6 w-6"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Sao chép link Endpoint</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </DialogHeader>

          {detailQuery.isLoading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              Đang tải dữ liệu API...
            </div>
          )}

          {detailQuery.error && (
            <div className="my-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{getMappedErrorMessage(detailQuery.error, 'Không thể tải thông tin API')}</span>
            </div>
          )}

          {api && !detailQuery.isLoading && (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="mt-2 space-y-4"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="keys" className="gap-1.5 text-xs">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Khóa chia sẻ ({keys.length})</span>
                </TabsTrigger>
                <TabsTrigger value="config" className="gap-1.5 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Cấu hình trường</span>
                </TabsTrigger>
                <TabsTrigger value="usage" className="gap-1.5 text-xs">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Thống kê sử dụng</span>
                </TabsTrigger>
              </TabsList>

              {/* ─── TAB 1: KEYS ─── */}
              <TabsContent value="keys" className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Mỗi đối tác sử dụng một khóa riêng với hạn mức truy cập độc lập.
                  </p>
                  <Button size="sm" onClick={() => setIssueKeyOpen(true)} className="gap-1.5 h-8">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cấp khóa mới</span>
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên khóa & Đơn vị</TableHead>
                        <TableHead>Nhận diện</TableHead>
                        <TableHead>Hạn mức</TableHead>
                        <TableHead>Hạn sử dụng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keys.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                            Chưa có khóa nào được cấp cho API này. Nhấn "Cấp khóa mới" để bắt đầu.
                          </TableCell>
                        </TableRow>
                      ) : (
                        keys.map((k) => {
                          const isRevoked = Boolean(k.revoked_at || k.revokedAt)
                          const isRotated = Boolean(k.rotated_at || k.rotatedAt)
                          const isExpired = k.expires_at ? new Date(k.expires_at) <= new Date() : false

                          return (
                            <TableRow key={k.id} className={isRevoked ? 'opacity-50' : ''}>
                              <TableCell>
                                <div className="max-w-[200px] space-y-1">
                                  <p className="font-semibold text-xs text-foreground truncate">{k.name}</p>
                                  <p className="text-muted-foreground text-[11px] truncate">
                                    Đơn vị: {k.consumer || 'Chung'}
                                  </p>
                                  {Array.isArray(k.scopes) && k.scopes.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {k.scopes.map((scope) => {
                                        const label =
                                          scope === 'features:read'
                                            ? 'Đọc'
                                            : scope === 'features:create'
                                              ? 'Thêm'
                                              : scope === 'features:update'
                                                ? 'Sửa'
                                                : scope === 'features:delete'
                                                  ? 'Xóa'
                                                  : scope
                                        const color =
                                          scope === 'features:read'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                            : scope === 'features:create'
                                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                              : scope === 'features:update'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                        return (
                                          <span
                                            key={scope}
                                            className={`inline-flex items-center rounded border px-1 py-0.5 font-mono text-[9px] font-semibold leading-none ${color}`}
                                            title={scope}
                                          >
                                            {label}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-xs">
                                  <span className="font-semibold">{k.token_hint || '...'}</span>
                                  {k.token_version ? (
                                    <span className="text-muted-foreground ml-1 text-[10px]">
                                      (v{k.token_version})
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {k.quota_per_minute ?? k.quotaPerMinute ?? 60} req/phút
                              </TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p>{k.expires_at ? formatDateTime(k.expires_at) : 'Vô thời hạn'}</p>
                                  {isExpired && !isRevoked && (
                                    <span className="text-destructive font-medium text-[10px]">
                                      Đã hết hạn
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {isRevoked ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Đã thu hồi
                                  </Badge>
                                ) : isRotated ? (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    Đã xoay
                                  </Badge>
                                ) : isExpired ? (
                                  <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">
                                    Hết hạn
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">
                                    Hoạt động
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!isRevoked && (
                                  <div className="flex justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-xs"
                                          onClick={() => handleOpenRotate(k)}
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Xoay khóa (Cấp token mới)</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-xs"
                                          onClick={() => handleOpenRevoke(k)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Ban className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Thu hồi khóa</TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ─── TAB 2: CONFIGURATION ─── */}
              <TabsContent value="config" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-3 rounded-lg border p-3">
                    <h4 className="text-xs font-semibold text-foreground">Trường cho phép đọc (readFields)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(api.read_fields) && api.read_fields.length > 0 ? (
                        api.read_fields.map((f) => (
                          <Badge key={f} variant="secondary" className="font-mono text-xs">
                            {f}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">Không có trường nào</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <h4 className="text-xs font-semibold text-foreground">Trường cho phép ghi (writeFields)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(api.write_fields) && api.write_fields.length > 0 ? (
                        api.write_fields.map((f) => (
                          <Badge key={f} variant="outline" className="border-amber-400 font-mono text-xs text-amber-600 dark:text-amber-400">
                            {f}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">Không có (chỉ đọc)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <h4 className="text-xs font-semibold text-foreground">Trường hỗ trợ tìm kiếm (searchFields)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(api.search_fields) && api.search_fields.length > 0 ? (
                        api.search_fields.map((f) => (
                          <Badge key={f} variant="outline" className="font-mono text-xs">
                            {f}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">Mặc định theo trường sắp xếp</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Trường sắp xếp mặc định</span>
                    <span className="font-mono font-semibold text-foreground">
                      {api.default_sort_field || 'name'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phương thức được phép</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.isArray(api.allowed_methods) && api.allowed_methods.length > 0 ? (
                        api.allowed_methods.map((method) => {
                          const methodColor =
                            method === 'GET'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                              : method === 'POST'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : method === 'PUT'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          return (
                            <span
                              key={method}
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none ${methodColor}`}
                            >
                              {method}
                            </span>
                          )
                        })
                      ) : (
                        <span className="inline-flex items-center rounded border border-blue-200 bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 leading-none dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                          GET
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Ngày tạo</span>
                    <span className="text-foreground">{formatDateTime(api.created_at)}</span>
                  </div>
                </div>
              </TabsContent>

              {/* ─── TAB 3: USAGE ─── */}
              <TabsContent value="usage" className="space-y-4">
                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <span className="text-muted-foreground text-xs">Tổng lượt gọi</span>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {usage?.summary?.calls ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <span className="text-muted-foreground text-xs">Lỗi thực thi</span>
                    <p className="mt-1 text-2xl font-bold text-destructive">
                      {usage?.summary?.errors ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <span className="text-muted-foreground text-xs">Bị chặn hạn mức</span>
                    <p className="mt-1 text-2xl font-bold text-amber-600">
                      {usage?.summary?.quota_rejections ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <span className="text-muted-foreground text-xs">Độ trễ trung bình</span>
                    <p className="mt-1 text-2xl font-bold text-foreground font-mono">
                      {usage?.summary?.avg_duration_ms ?? 0} <span className="text-xs font-normal">ms</span>
                    </p>
                  </div>
                </div>

                {/* Per-key usage breakdown */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên đối tác</TableHead>
                        <TableHead>Lượt gọi</TableHead>
                        <TableHead className="text-right">Lần gọi cuối</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!usage?.byKey || usage.byKey.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-center text-muted-foreground text-xs">
                            Chưa có dữ liệu gọi API nào được ghi nhận.
                          </TableCell>
                        </TableRow>
                      ) : (
                        usage.byKey.map((item) => {
                          const keyInfo = keyMap.get(item.key_id)
                          const partnerName = keyInfo?.consumer || keyInfo?.name || 'Đối tác chưa đặt tên'
                          return (
                            <TableRow key={item.key_id}>
                              <TableCell className="text-xs">
                                <div className="font-semibold text-foreground">{partnerName}</div>
                                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                                  <span>ID: {item.key_id.slice(0, 8)}...</span>
                                  {keyInfo?.token_hint && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                                      Hint: {keyInfo.token_hint}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-xs">{item.calls} lượt</TableCell>
                              <TableCell className="text-right text-xs">
                                {item.last_called_at ? formatDateTime(item.last_called_at) : 'Chưa gọi'}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Issue new key */}
      <IssueKeyDialog
        open={issueKeyOpen}
        onOpenChange={setIssueKeyOpen}
        registryId={apiId}
        registryName={api?.name}
        slug={api?.slug}
        allowedMethods={api?.allowed_methods}
        onKeyIssued={(issued) => {
          keysQuery.refetch()
          setIsRotation(false)
          setIssuedTokenData(issued)
          setTokenModalOpen(true)
        }}
      />

      {/* Sub-Dialog: Token issued modal */}
      <TokenIssuedModal
        open={tokenModalOpen}
        onOpenChange={setTokenModalOpen}
        data={issuedTokenData}
        slug={api?.slug}
        isRotation={isRotation}
      />

      {/* Confirm Rotate Dialog */}
      <AlertDialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoay khóa API (Rotate Key)</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xoay khóa "{keyToRotate?.name}"? Hệ thống sẽ tạo một chuỗi mã
              Token mới và vô hiệu hóa mã Token cũ ngay lập tức.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={rotateMutation.isPending}
              onClick={() => {
                if (keyToRotate?.id) rotateMutation.mutate(keyToRotate.id)
              }}
            >
              {rotateMutation.isPending ? 'Đang xoay...' : 'Xác nhận xoay khóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Revoke Dialog */}
      <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Thu hồi khóa API (Revoke Key)</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn thu hồi khóa "{keyToRevoke?.name}"? Đơn vị "{keyToRevoke?.consumer}"
              sẽ không thể tiếp tục gọi API bằng khóa này. Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (keyToRevoke?.id) revokeMutation.mutate(keyToRevoke.id)
              }}
            >
              {revokeMutation.isPending ? 'Đang thu hồi...' : 'Thu hồi ngay'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}