import type { JSX } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  Copy,
  ExternalLink,
  KeyRound,
  Layers,
  Pen,
  Plus,
  Trash2,
} from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { mapLayerApiService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type {
  ApiResponse,
  MapApiKeyIssueData,
  MapLayer,
  MapLayerApi,
  MapLayerApiListData,
  Pagination,
} from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import { hasMapLayerApiPermission } from '@/components/map-layer-apis/permissionUtils'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { ACTIVE_CLASS, ACTIVE_DOT, ACTIVE_LABEL } from '@/constant/mapLayerConstant'
import MapLayerApiDetailDialog from './MapLayerApiDetailDialog'
import MapLayerApiFormDialog from './MapLayerApiFormDialog'
import IssueKeyDialog from '@/components/map-layer-apis/IssueKeyDialog'
import TokenIssuedModal from '@/components/map-layer-apis/TokenIssuedModal'

function getMapApis(data: unknown): MapLayerApi[] {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return response?.data?.items ?? response?.data?.apis ?? []
}

function getPagination(data: unknown): Partial<Pagination> {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return (response?.metadata ?? response?.data?.pagination ?? {}) as Partial<Pagination>
}

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as
    | ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]>
    | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function layerLabel(layer: MapLayer) {
  return layer.name_vi || layer.name || layer.code
}

export default function MapLayerApiListPage(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const canCreate = hasMapLayerApiPermission(user, 'create')
  const canUpdate = hasMapLayerApiPermission(user, 'update')
  const canDelete = hasMapLayerApiPermission(user, 'delete')

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')
  const [layerFilter, setLayerFilter] = useState<string>('all')

  const queryParams = {
    page: currentPage,
    limit,
    ...(searchValue.trim() && { q: searchValue.trim() }),
    ...(activeFilter !== 'all' && { is_active: activeFilter === 'true' }),
    ...(layerFilter !== 'all' && { layer_id: Number(layerFilter) }),
  }

  const listQuery = useApiQuery(
    ['mapLayerApis', queryParams],
    () => mapLayerApiService.getAll(queryParams),
    {},
    false,
    false
  )

  const layerOptionsQuery = useApiQuery(
    ['map-layers-for-map-api-filter'],
    () => mapLayerService.getAll({ page: 1, limit: 100 }),
    {},
    false,
    false
  )

  const apis = getMapApis(listQuery.data)
  const layerOptions = useMemo(
    () => getLayerItems(layerOptionsQuery.data),
    [layerOptionsQuery.data]
  )
  const filteredApis = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return apis
    return apis.filter((api) =>
      [api.name, api.slug, api.layer_code, api.layer_name, api.layer_name_vi]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [apis, searchValue])

  const pagination = getPagination(listQuery.data)
  const lastTotalPagesRef = useRef(1)
  if (pagination.totalPages !== undefined) {
    lastTotalPagesRef.current = Math.max(1, pagination.totalPages)
  }
  const totalPages = lastTotalPagesRef.current
  const total = pagination?.total ?? filteredApis.length

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const [selectedApiId, setSelectedApiId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [apiToDelete, setApiToDelete] = useState<MapLayerApi | null>(null)

  // Direct Issue Key state
  const [issueKeyOpen, setIssueKeyOpen] = useState(false)
  const [targetRegistryForIssue, setTargetRegistryForIssue] = useState<MapLayerApi | null>(null)

  // Token result modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [issuedTokenData, setIssuedTokenData] = useState<MapApiKeyIssueData | null>(null)
  const [issuedSlug, setIssuedSlug] = useState<string>('')

  const deleteMutation = useApiMutation(
    (data: { id: number; expectedVersion?: number | string }) =>
      mapLayerApiService.delete(data.id, data.expectedVersion),
    {
      onSuccess: () => {
        toast.success('Xóa API chia sẻ thành công')
        listQuery.refetch()
        setDeleteDialogOpen(false)
        setApiToDelete(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xóa API chia sẻ.'))
      },
    },
    false
  )

  function openDetails(api: MapLayerApi) {
    if (api?.id) {
      setSelectedApiId(Number(api.id))
      setDetailDialogOpen(true)
    }
  }

  function openAddDialog() {
    setSelectedApiId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(api: MapLayerApi) {
    setSelectedApiId(Number(api.id))
    setFormDialogOpen(true)
  }

  function openDeleteDialog(api: MapLayerApi) {
    setApiToDelete(api)
    setDeleteDialogOpen(true)
  }

  function openQuickIssueKey(api: MapLayerApi) {
    setTargetRegistryForIssue(api)
    setIssueKeyOpen(true)
  }

  function handleDelete() {
    if (apiToDelete) {
      deleteMutation.mutate({ id: Number(apiToDelete.id), expectedVersion: apiToDelete.version })
    }
  }

  const handleCopyEndpoint = async (slug?: string) => {
    if (!slug) return
    const url = `https://apicampha.tourismpj.pro.vn/api/v1/shared/${slug}/features`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã sao chép link Endpoint')
    } catch {
      toast.error('Không thể sao chép')
    }
  }

  return (
    <PageLayout
      title="Quản lý API Lớp bản đồ"
      description="Đăng ký và cấp khóa chia sẻ dữ liệu GeoJSON cho các đối tác tích hợp"
    >
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        filter={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={layerFilter}
              onValueChange={(value) => {
                setLayerFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Lớp bản đồ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp bản đồ</SelectItem>
                {layerOptions.map((layer) => (
                  <SelectItem key={layer.id ?? layer.code} value={String(layer.id)}>
                    {layerLabel(layer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activeFilter}
              onValueChange={(value) => {
                setActiveFilter(value as 'all' | 'true' | 'false')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="true">Đang hoạt động</SelectItem>
                <SelectItem value="false">Tạm dừng</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${limit}`}
              onValueChange={(value) => {
                setLimit(parseInt(value, 10))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / trang</SelectItem>
                <SelectItem value="20">20 / trang</SelectItem>
                <SelectItem value="50">50 / trang</SelectItem>
              </SelectContent>
            </Select>

            {canCreate && (
              <Button onClick={openAddDialog} className="gap-1.5">
                <Plus className="size-4" />
                <span>Đăng ký API mới</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/public/map-apis')}
              className="gap-1.5"
            >
              <ExternalLink className="size-4" />
              <span>Public Test</span>
            </Button>
          </div>
        }
        total={total}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page: number) => setCurrentPage(page),
        }}
      >
        <Table className="relative">
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Lớp bản đồ</TableHead>
              <TableHead>Tên API & Endpoint (Slug)</TableHead>
              <TableHead>Cấu hình trường</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {listQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm">Đang tải danh sách API...</span>
                    </div>
                  ) : (
                    <div>
                      <Layers className="mx-auto h-8 w-8 opacity-30" />
                      <p className="mt-2 text-sm">Chưa có API lớp bản đồ nào được đăng ký.</p>
                      {canCreate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openAddDialog}
                          className="mt-3 gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          <span>Đăng ký ngay</span>
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredApis.map((api) => (
                <TableRow
                  key={api.id}
                  className="hover:cursor-pointer transition-colors"
                  onClick={() => openDetails(api)}
                >
                  <TableCell className="font-mono text-xs">{api.id}</TableCell>
                  <TableCell>
                    <div className="max-w-[220px] min-w-0">
                      <p className="truncate font-semibold text-xs text-foreground" title={api.layer_name || api.layer_name_vi || api.layer_code || ''}>
                        {api.layer_name || api.layer_name_vi || api.layer_code || '-'}
                      </p>
                      {api.layer_code && (
                        <p className="text-muted-foreground truncate font-mono text-[11px]" title={api.layer_code}>
                          Mã: {api.layer_code}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[260px] min-w-0 space-y-1">
                      <p className="font-medium text-xs text-foreground break-words line-clamp-2" title={api.name}>{api.name}</p>
                      {api.slug && (
                        <div
                          className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground max-w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyEndpoint(api.slug)
                          }}
                        >
                          <span className="truncate break-all">/{api.slug}/features</span>
                          <Copy className="size-3 shrink-0 opacity-60" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
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
                                className={`inline-flex items-center rounded border px-1 py-0.5 font-mono text-[9px] font-semibold leading-none ${methodColor}`}
                              >
                                {method}
                              </span>
                            )
                          })
                        ) : (
                          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-blue-700 leading-none dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                            GET
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {api.read_fields?.length ?? 0} trường đọc
                        </Badge>
                        {api.write_fields && api.write_fields.length > 0 && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400 text-[10px]">
                            {api.write_fields.length} ghi
                          </Badge>
                        )}
                        {api.search_fields && api.search_fields.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {api.search_fields.length} tìm
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusDotBadge
                      label={ACTIVE_LABEL[String(api.is_active)]}
                      badgeClass={ACTIVE_CLASS[String(api.is_active)]}
                      dotClass={ACTIVE_DOT[String(api.is_active)]}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(api.updated_at || api.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Quản lý khóa và thống kê"
                            onClick={() => openDetails(api)}
                          >
                            <KeyRound className="size-4 text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Quản lý khóa & Thống kê</TooltipContent>
                      </Tooltip>

                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Cấp khóa nhanh"
                              onClick={() => openQuickIssueKey(api)}
                            >
                              <Plus className="size-4 text-emerald-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Cấp khóa mới cho đối tác</TooltipContent>
                        </Tooltip>
                      )}

                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Chỉnh sửa"
                              onClick={() => openEditDialog(api)}
                            >
                              <Pen className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Chỉnh sửa API</TooltipContent>
                        </Tooltip>
                      )}

                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Xóa"
                              onClick={() => openDeleteDialog(api)}
                            >
                              <Trash2 className="text-destructive size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Xóa API</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      {/* Registry Detail & Key Management Dialog */}
      <MapLayerApiDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        apiId={selectedApiId}
      />

      {/* Form Dialog for Create / Edit Registry */}
      <MapLayerApiFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        apiId={selectedApiId}
        onSaved={() => {
          listQuery.refetch()
        }}
      />

      {/* Quick Issue Key Dialog */}
      <IssueKeyDialog
        open={issueKeyOpen}
        onOpenChange={setIssueKeyOpen}
        registryId={targetRegistryForIssue?.id ?? null}
        registryName={targetRegistryForIssue?.name}
        slug={targetRegistryForIssue?.slug}
        allowedMethods={targetRegistryForIssue?.allowed_methods}
        onKeyIssued={(issued) => {
          setIssuedSlug(targetRegistryForIssue?.slug || '')
          setIssuedTokenData(issued)
          setTokenModalOpen(true)
          listQuery.refetch()
        }}
      />

      {/* Token Result Modal */}
      <TokenIssuedModal
        open={tokenModalOpen}
        onOpenChange={setTokenModalOpen}
        data={issuedTokenData}
        slug={issuedSlug}
      />

      {/* Confirm Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa API chia sẻ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa API "{apiToDelete?.name}"? Hệ thống sẽ thu hồi toàn bộ các
              khóa đã cấp và đối tác sẽ không thể tiếp tục đọc dữ liệu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa API'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}