import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { mapImageService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  Pagination,
  PdfMap,
  PdfMapListData,
  UpdatePdfMapBody,
} from '@/types/api'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { formatDate } from '@/lib/date'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import MapImageDetailDialog from './MapImageDetailDialog'
import MapImageFormDialog from './MapImageFormDialog'

type PdfMapFormPayload = UpdatePdfMapBody

export default function MapImagePage() {
  const user = useAuthStore((state) => state.user)
  const canCreate = hasPerm(user, 'pdf_maps', 'create')
  const canUpdate = hasPerm(user, 'pdf_maps', 'update')
  const canDelete = hasPerm(user, 'pdf_maps', 'delete')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<PdfMap | null>(null)

  const params = useMemo(
    () => ({
      page,
      limit,
      sortBy: 'id',
      sortOrder: 'DESC' as const,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [page, limit, q]
  )
  const query = useApiQuery(
    ['pdfMaps', params],
    () => mapImageService.getAll(params),
    {},
    false,
    false
  )
  const response = query.data as ApiResponse<PdfMapListData> | undefined
  const items = response?.data?.items ?? []
  const pagination = (response?.metadata ?? {}) as Partial<Pagination>
  const lastTotalPages = useRef(1)
  if (pagination.totalPages !== undefined) {
    lastTotalPages.current = Math.max(1, pagination.totalPages)
  }
  const totalPages = pagination.totalPages ?? lastTotalPages.current

  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages))
  }, [page, totalPages])

  const createMutation = useApiMutation((data: FormData) => mapImageService.create(data), {
    onSuccess: () => {
      setFormOpen(false)
      query.refetch()
    },
  })
  const updateMutation = useApiMutation(
    ({ id, data }: { id: number; data: PdfMapFormPayload }) => mapImageService.update(id, data),
    {
      onSuccess: () => {
        setFormOpen(false)
        setSelectedId(null)
        query.refetch()
      },
    }
  )
  const deleteMutation = useApiMutation(
    (data: { id: number; expectedUpdatedAt: string }) => mapImageService.delete(data.id, data.expectedUpdatedAt),
    {
    onSuccess: () => {
      setDeleteItem(null)
      query.refetch()
    },
    }
  )

  const submitForm = (payload: FormData | PdfMapFormPayload) => {
    if (selectedId) updateMutation.mutate({ id: selectedId, data: payload as PdfMapFormPayload })
    else createMutation.mutate(payload as FormData)
  }

  return (
    <PageLayout
      title="Ảnh bản đồ"
      description="Quản lý bản đồ PDF và ảnh bản đồ chuyên đề hiển thị trên cổng công khai"
    >
      <ToolTableCustom
        searchValue={q}
        setSearchValue={(value) => {
          setQ(value)
          setPage(1)
        }}
        filter={
          <div className="flex flex-wrap gap-2">
            <Select value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            {canCreate && (
              <Button onClick={() => { setSelectedId(null); setFormOpen(true) }}>
                <Plus className="size-4" /> Thêm ảnh bản đồ
              </Button>
            )}
          </div>
        }
        total={pagination.total ?? items.length}
        pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Tỉ lệ</TableHead>
              <TableHead>Năm</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center">Đang tải dữ liệu...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Chưa có ảnh bản đồ phù hợp.</TableCell></TableRow>
            ) : items.map((item) => {
              const isPublic = item.isPublic ?? item.visibility === 'public'
              const year = item.year ?? item.map_year
              const createdAt = item.createdAt ?? item.created_at
              return (
              <TableRow key={item.id} className="cursor-pointer" onClick={() => { setSelectedId(item.id); setDetailOpen(true) }}>
                <TableCell className="font-medium">{item.title || item.fileName || item.original_name || `Bản đồ #${item.id}`}</TableCell>
                <TableCell>{item.scale_label ?? item.scale ?? '-'}</TableCell>
                <TableCell>{year ?? '-'}</TableCell>
                <TableCell><Badge variant={isPublic ? 'default' : 'secondary'}>{isPublic ? 'Công khai' : 'Nội bộ'}</Badge></TableCell>
                <TableCell>{createdAt ? formatDate(createdAt) : '-'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canUpdate && <Button variant="ghost" size="icon" tooltip="Chỉnh sửa" onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); setFormOpen(true) }}><Pencil className="size-4" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" tooltip="Xóa" onClick={(event) => { event.stopPropagation(); setDeleteItem(item) }}><Trash2 className="size-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            )})}

          </TableBody>
        </Table>
      </ToolTableCustom>

      <MapImageDetailDialog open={detailOpen} onOpenChange={setDetailOpen} mapImageId={selectedId} />
      <MapImageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mapImageId={selectedId}
        onSubmit={submitForm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa ảnh bản đồ?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteItem?.title || deleteItem?.fileName}” sẽ bị ẩn khỏi hệ thống. Thao tác này không thể hoàn tác trên giao diện.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteItem && deleteMutation.mutate({
                id: deleteItem.id,
                expectedUpdatedAt: deleteItem.updatedAt ?? deleteItem.updated_at ?? '',
              })}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
