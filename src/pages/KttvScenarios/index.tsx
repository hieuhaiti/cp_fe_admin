import type { JSX } from 'react'
import { useState } from 'react'
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
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pen, Trash2, Plus } from 'lucide-react'
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

export default function KttvScenariosPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'kttv_scenarios', 'create')
  const canUpdate = hasPerm(user, 'kttv_scenarios', 'update')
  const canDelete = hasPerm(user, 'kttv_scenarios', 'delete')

  const [currentPage, setCurrentPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [limit, setLimit] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FloodScenario | null>(null)

  const queryParams = { page: currentPage, limit }

  const dbQuery = useApiQuery(
    ['kttv-scenarios', queryParams],
    () => kttvScenarioService.getAll(queryParams),
    {},
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
        setDeleteDialogOpen(false)
        setItemToDelete(null)
        toast.success('Xóa kịch bản thành công')
      },
    },
    true
  )

  function openCreateDialog() {
    setSelectedId(null)
    setFormOpen(true)
  }

  function openEditDialog(item: FloodScenario) {
    setSelectedId(item.id)
    setFormOpen(true)
  }

  function openDeleteDialog(item: FloodScenario) {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  return (
    <PageLayout
      title="Kịch bản thủy văn"
      description="Quản lý kịch bản phát hiện sự kiện ngập lụt"
    >
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={(value) => {
          setSearchValue(value)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
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
              <Button variant="default" onClick={openCreateDialog}>
                <Plus className="size-4" />
                Thêm kịch bản
              </Button>
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
              <TableHead className="w-24">Ưu tiên</TableHead>
              <TableHead className="w-24">Trạng thái</TableHead>
              <TableHead className="w-32">Ngày tạo</TableHead>
              <TableHead className="w-24 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              scenarios.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-sm">{item.matchPriority ?? 0}</TableCell>
                  <TableCell className="text-sm">
                    {item.isEnabled ? '✓ Kích hoạt' : '— Vô hiệu'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.createdAt ? formatDate(item.createdAt) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          tooltip="Chỉnh sửa"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pen className="size-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          tooltip="Xóa"
                          onClick={() => openDeleteDialog(item)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <KttvScenarioFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        scenarioId={selectedId}
        onSaved={() => dbQuery.refetch()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa kịch bản "{itemToDelete?.name}"? Hành động này không thể
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
