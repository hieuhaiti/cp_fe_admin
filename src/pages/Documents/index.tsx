import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { documentService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, Document, DocumentListData, Pagination, UpdateDocumentBody } from '@/types/api'
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
import DocumentDetailDialog from './DocumentDetailDialog'
import DocumentFormDialog from './DocumentFormDialog'

export default function DocumentsPage() {
  const user = useAuthStore((state) => state.user)
  const canCreate = hasPerm(user, 'documents', 'create')
  const canUpdate = hasPerm(user, 'documents', 'update')
  const canDelete = hasPerm(user, 'documents', 'delete')

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<Document | null>(null)

  const params = useMemo(
    () => ({
      page,
      limit,
      sortBy: 'issued_at' as const,
      sortOrder: 'DESC' as const,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [page, limit, q],
  )

  const query = useApiQuery(
    ['documents', params],
    () => documentService.getAll(params),
    {},
    false,
    false,
  )
  const response = query.data as ApiResponse<DocumentListData> | undefined
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

  const createMutation = useApiMutation((data: FormData) => documentService.create(data), {
    onSuccess: () => { setFormOpen(false); query.refetch() },
  })
  const updateMutation = useApiMutation(
    ({ id, data }: { id: number; data: UpdateDocumentBody }) => documentService.update(id, data),
    { onSuccess: () => { setFormOpen(false); setSelectedId(null); query.refetch() } },
  )
  const deleteMutation = useApiMutation(
    (data: { id: number; expectedUpdatedAt: string }) =>
      documentService.delete(data.id, data.expectedUpdatedAt),
    { onSuccess: () => { setDeleteItem(null); query.refetch() } },
  )

  const submitForm = (payload: FormData | UpdateDocumentBody) => {
    if (selectedId) updateMutation.mutate({ id: selectedId, data: payload as UpdateDocumentBody })
    else createMutation.mutate(payload as FormData)
  }

  return (
    <PageLayout
      title="Văn bản tài liệu"
      description="Quản lý văn bản, tài liệu hiển thị trên cổng thông tin"
    >
      <ToolTableCustom
        searchValue={q}
        setSearchValue={(value) => { setQ(value); setPage(1) }}
        filter={
          <div className="flex flex-wrap gap-2">
            <Select
              value={String(limit)}
              onValueChange={(value) => { setLimit(Number(value)); setPage(1) }}
            >
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((v) => (
                  <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreate && (
              <Button onClick={() => { setSelectedId(null); setFormOpen(true) }}>
                <Plus className="size-4" /> Thêm văn bản
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
              <TableHead>Mã văn bản</TableHead>
              <TableHead>Cơ quan ban hành</TableHead>
              <TableHead>Ngày ban hành</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">Đang tải dữ liệu...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Chưa có văn bản phù hợp.
                </TableCell>
              </TableRow>
            ) : items.map((item) => {
              const isPublic = item.visibility === 'public'
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => { setSelectedId(item.id); setDetailOpen(true) }}
                >
                  <TableCell className="max-w-64 font-medium">
                    <span className="line-clamp-2">{item.title}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.document_code}</TableCell>
                  <TableCell className="max-w-48">
                    <span className="line-clamp-1">{item.issuing_agency}</span>
                  </TableCell>
                  <TableCell>
                    {item.issued_at ? formatDate(item.issued_at) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isPublic ? 'default' : 'secondary'}>
                      {isPublic ? 'Công khai' : 'Nội bộ'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          tooltip="Chỉnh sửa"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); setFormOpen(true) }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          tooltip="Xóa"
                          onClick={(e) => { e.stopPropagation(); setDeleteItem(item) }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <DocumentDetailDialog open={detailOpen} onOpenChange={setDetailOpen} documentId={selectedId} />
      <DocumentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        documentId={selectedId}
        onSubmit={submitForm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa văn bản?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteItem?.title}" sẽ bị ẩn khỏi hệ thống. Thao tác này không thể hoàn tác trên giao diện.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteItem &&
                deleteMutation.mutate({
                  id: deleteItem.id,
                  expectedUpdatedAt: deleteItem.updated_at,
                })
              }
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
