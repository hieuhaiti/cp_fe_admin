import type { JSX } from 'react'
import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KttvInputForm from './KttvInputForm'
import { useApiQuery, useApiMutation, kttvScenarioService } from '@/service'
import type { ApiResponse, Pagination } from '@/types/api'
import type { FloodScenario, FloodScenarioListData } from '@/service/kttvScenarioService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pen, Trash2, Plus, Layers } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { toast } from 'react-toastify'
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
import KttvScenarioFormDialog from './KttvScenarioFormDialog'
import KttvConvertFromLayersDialog from './KttvConvertFromLayersDialog'
import {
  SCENARIO_TYPES,
  SCENARIO_TYPE_LIST,
  type ScenarioTypeId,
} from './constants'
import { inferScenarioType } from './helpers'
import './scenarios.css'

function resolveScenarioType(scenario: FloodScenario): ScenarioTypeId {
  return scenario.type || inferScenarioType(scenario).type || 'hien_trang'
}

export default function KttvScenariosPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'flood', 'run')
  const canUpdate = hasPerm(user, 'flood', 'run')
  const canDelete = hasPerm(user, 'flood', 'run')

  const [currentPage, setCurrentPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [limit, setLimit] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | string | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<FloodScenario | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FloodScenario | null>(null)

  const [typeFilter, setTypeFilter] = useState<ScenarioTypeId>('hien_trang')

  const queryParams = {
    page: currentPage,
    limit,
    type: typeFilter,
    search: searchValue.trim() || undefined,
  }

  const dbQuery = useApiQuery(
    ['kttv-scenarios', queryParams],
    () => kttvScenarioService.getAll(queryParams),
    {},
    false,
    false
  )

  const statsQuery = useApiQuery(
    ['kttv-scenarios-all-stats'],
    () => kttvScenarioService.getAll({ page: 1, limit: 100 }),
    { staleTime: 30 * 1000 },
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<any> | undefined
  const data = raw?.data as FloodScenarioListData | undefined
  const scenarios: FloodScenario[] = data?.items ?? []
  const pagination = (data?.pagination ?? raw?.metadata ?? {}) as Partial<Pagination>
  const totalPages = Math.max(1, pagination.totalPages ?? 1)
  const total = pagination?.total ?? 0

  const deleteMutation = useApiMutation(
    (id: number | string) => kttvScenarioService.delete(id),
    {
      onSuccess: () => {
        dbQuery.refetch()
        statsQuery.refetch()
        setDeleteDialogOpen(false)
        setItemToDelete(null)
        toast.success('Xóa kịch bản thành công')
      },
    },
    true
  )

  const allForStats = (statsQuery.data as ApiResponse<any> | undefined)?.data?.items ?? scenarios
  const stats = useMemo(() => {
    return SCENARIO_TYPE_LIST.reduce<Record<ScenarioTypeId, number>>(
      (counts, type) => {
        counts[type.id] = allForStats.filter(
          (scenario: FloodScenario) => resolveScenarioType(scenario) === type.id
        ).length
        return counts
      },
      { hien_trang: 0, cai_tao: 0, quy_hoach: 0 }
    )
  }, [allForStats, scenarios])

  function openCreateDialog() {
    setSelectedId(null)
    setSelectedScenario(null)
    setFormOpen(true)
  }

  function openEditDialog(item: FloodScenario) {
    setSelectedId(item.id)
    setSelectedScenario(item)
    setFormOpen(true)
  }

  function openDeleteDialog(item: FloodScenario) {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => resolveScenarioType(scenario) === typeFilter)
  }, [scenarios, typeFilter])

  const selectedType = SCENARIO_TYPES[typeFilter]

  return (
    <PageLayout title="Kịch bản thủy văn" description="Quản lý kịch bản phát hiện sự kiện ngập lụt">
      <Tabs defaultValue="manage" className="space-y-4">
        <TabsList className="grid w-full sm:w-80 grid-cols-2">
          <TabsTrigger value="manage">Quản lý kịch bản</TabsTrigger>
          <TabsTrigger value="input">Nhập kịch bản</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-4">
          <KttvInputForm />
        </TabsContent>

        <TabsContent value="manage" className="space-y-4 px-2">
          <div className="scenario-overview-grid">
            {SCENARIO_TYPE_LIST.map((type) => {
              const count = stats[type.id]
              const isSelected = typeFilter === type.id

              return (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => setTypeFilter(type.id)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border p-3.5 text-left transition-all cursor-pointer bg-card ${
                    isSelected ? 'ring-2 ring-primary border-primary/50 shadow-sm' : 'hover:border-primary/30 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`scenario-type-badge ${type.id}`}>
                      {type.shortLabel}
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {count} kịch bản
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">{type.label}</h4>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{type.description}</p>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-sm font-semibold text-foreground">
                Danh sách kịch bản — {selectedType.label}
              </h3>
            </div>

            <ToolTableCustom
              searchValue={searchValue}
              setSearchValue={(value) => {
                setSearchValue(value)
                setCurrentPage(1)
              }}
              filter={
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={`${limit}`}
                    onValueChange={(v) => {
                      setLimit(parseInt(v, 10))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>

                  {canCreate && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setConvertOpen(true)}>
                        <Layers className="size-4" />
                        Chuyển từ lớp bản đồ
                      </Button>
                      <Button variant="default" onClick={openCreateDialog}>
                        <Plus className="size-4" />
                        Thêm kịch bản
                      </Button>
                    </div>
                  )}
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
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead className="w-36">Phân loại</TableHead>
                    <TableHead className="w-36">Lượng mưa (mm)</TableHead>
                    <TableHead className="w-28">Triều (m)</TableHead>
                    <TableHead>Lớp bản đồ</TableHead>
                    <TableHead className="">Trạng thái</TableHead>
                    <TableHead className="w-32">Ngày tạo</TableHead>
                    <TableHead className="w-24 text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScenarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScenarios.map((item) => {
                      const scenarioType = resolveScenarioType(item)
                      const inferred = inferScenarioType(item)
                      return (
                        <TableRow
                          key={item.id}
                          className="hover:cursor-pointer"
                          onClick={() => openEditDialog(item)}
                        >
                          <TableCell>{item.id}</TableCell>
                          <TableCell className="font-mono text-sm">{item.code}</TableCell>
                          <TableCell>{item.name_vi}</TableCell>
                          <TableCell>
                            <span className={`scenario-type-badge ${scenarioType}`}>
                              {SCENARIO_TYPES[scenarioType].shortLabel}
                              {inferred.rcp ? ` (${inferred.rcp.toUpperCase()})` : ''}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.min_rainfall ?? '—'} – {item.max_rainfall ?? '∞'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.min_tide ?? '—'} – {item.max_tide ?? '∞'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.layer?.nameVi ?? item.layer_code}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.is_active ? '✓ Kích hoạt' : '— Vô hiệu'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.created_at ? formatDate(item.created_at) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canUpdate && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  tooltip="Chỉnh sửa"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditDialog(item)
                                  }}
                                >
                                  <Pen className="size-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  tooltip="Xóa"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openDeleteDialog(item)
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="text-destructive size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ToolTableCustom>
          </div>
        </TabsContent>
      </Tabs>

      <KttvScenarioFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setSelectedScenario(null)
            setSelectedId(null)
          }
        }}
        scenarioId={selectedId}
        initialScenario={selectedScenario}
        defaultType={selectedScenario ? resolveScenarioType(selectedScenario) : typeFilter}
        defaultLayerCode={
          selectedScenario
            ? selectedScenario.layer_code
            : filteredScenarios.find((s) => Boolean(s.layer_code))?.layer_code
        }
        onSaved={() => {
          dbQuery.refetch()
          statsQuery.refetch()
        }}
      />

      <KttvConvertFromLayersDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        defaultType={typeFilter}
        onConverted={() => {
          dbQuery.refetch()
          statsQuery.refetch()
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa kịch bản "{itemToDelete?.name_vi}"? Hành động này không thể
              hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
