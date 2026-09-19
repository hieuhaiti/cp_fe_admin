import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Eye,
  EyeOff,
  FolderTree,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useLayerCategories } from '@/hooks/useLayerCategories'
import { toast } from 'react-toastify'
import type { LayerCategory } from '@/types/api'
import { cn } from '@/lib/utils'

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

export default function CategoryManagementTab() {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<LayerCategory | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const {
    categories,
    isLoading,
    isError,
    error,
    refetch,
    createCategory,
    isCreating,
    deleteCategory,
    isDeleting,
    updateVisibility,
    isUpdatingVisibility,
  } = useLayerCategories()

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    const q = search.trim().toLowerCase()
    if (!q) return categories
    const qNoTone = removeVietnameseTones(q)
    return categories.filter((c) => {
      const nameLower = c.name.toLowerCase()
      const keyLower = c.key.toLowerCase()
      const nameNoTone = removeVietnameseTones(c.name)
      return (
        nameLower.includes(q) ||
        keyLower.includes(q) ||
        nameNoTone.includes(qNoTone)
      )
    })
  }, [categories, search])

  const handleOpenCreate = () => {
    setNewCategoryName('')
    setCreateError(null)
    setIsCreateOpen(true)
  }

  const handleSaveCreate = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setCreateError('Vui lòng nhập tên danh mục')
      return
    }
    if (trimmed.length < 2) {
      setCreateError('Tên danh mục phải có ít nhất 2 ký tự')
      return
    }
    if (trimmed.length > 120) {
      setCreateError('Tên danh mục không được vượt quá 120 ký tự')
      return
    }

    setCreateError(null)
    try {
      const created = await createCategory(trimmed)
      toast.success(`Đã thêm danh mục "${created.name}" thành công.`)
      setIsCreateOpen(false)
      setNewCategoryName('')
    } catch (err: unknown) {
      const anyErr = err as {
        body?: { message?: string }
        response?: { data?: { message?: string } }
        message?: string
      }
      setCreateError(
        anyErr?.body?.message ||
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        'Không thể tạo danh mục mới'
      )
    }
  }

  const handleToggleVisibility = async (cat: LayerCategory) => {
    const nextVisibility = cat.isVisible === false
    setTogglingKey(cat.key)
    try {
      await updateVisibility({ key: cat.key, isVisible: nextVisibility })
      toast.success(
        nextVisibility
          ? `Đã bật hiển thị danh mục "${cat.name}" trên WebGIS.`
          : `Đã ẩn danh mục "${cat.name}" khỏi WebGIS.`
      )
    } catch (err: unknown) {
      const anyErr = err as {
        body?: { message?: string }
        response?: { data?: { message?: string } }
        message?: string
      }
      toast.error(
        anyErr?.body?.message ||
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        'Không thể cập nhật trạng thái hiển thị'
      )
    } finally {
      setTogglingKey(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget.key)
      toast.success(`Đã xóa danh mục "${deleteTarget.name}" thành công.`)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const anyErr = err as {
        body?: { message?: string }
        response?: { data?: { message?: string } }
        message?: string
      }
      toast.error(
        anyErr?.body?.message ||
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        'Không thể xóa danh mục'
      )
    }
  }

  return (
    <div className="space-y-4">
      {/* Header controls: Search & Add new */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-lg border">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FolderTree className="size-4 text-primary" />
            Danh mục lớp dữ liệu
          </h3>
          <p className="text-xs text-muted-foreground">
            Quản lý nhóm phân loại lớp bản đồ, cấu hình ẩn/hiện trên WebGIS và theo dõi số lượng lớp đang sử dụng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Tìm danh mục..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 gap-1.5 shrink-0"
          >
            <Plus className="size-4" />
            <span>Thêm danh mục</span>
          </Button>
        </div>
      </div>

      {/* Main content: Table of categories */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="size-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải danh sách danh mục...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="size-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive font-medium">
              Không thể tải danh sách danh mục: {(error as Error)?.message || 'Lỗi không xác định'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span>Thử lại</span>
            </Button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              {search ? `Không tìm thấy danh mục nào phù hợp với "${search}"` : 'Chưa có danh mục nào.'}
            </p>
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearch('')}
                className="text-xs text-primary"
              >
                Xóa bộ lọc tìm kiếm
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="min-w-[180px]">Tên danh mục</TableHead>
                <TableHead className="min-w-[140px]">Mã định danh (Key)</TableHead>
                <TableHead className="min-w-[140px] text-center">Số lượng lớp bản đồ</TableHead>
                <TableHead className="min-w-[160px] text-center">Hiển thị WebGIS</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((cat, index) => {
                const isVisible = cat.isVisible !== false
                const isToggling = isUpdatingVisibility && togglingKey === cat.key
                const layerCount = cat.layerCount ?? 0
                const hasLayers = layerCount > 0

                return (
                  <TableRow key={cat.key} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {cat.name}
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono text-muted-foreground border">
                        {cat.key}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={hasLayers ? 'secondary' : 'outline'}
                            className={cn(
                              'gap-1.5 font-normal text-xs px-2.5 py-0.5',
                              hasLayers
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'text-muted-foreground'
                            )}
                          >
                            <Layers className="size-3 shrink-0" />
                            <span>{layerCount} lớp</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasLayers
                            ? `Danh mục đang được dùng bởi ${layerCount} lớp bản đồ`
                            : 'Chưa có lớp bản đồ nào thuộc danh mục này'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={isVisible ? 'outline' : 'ghost'}
                            size="sm"
                            disabled={isToggling}
                            onClick={() => handleToggleVisibility(cat)}
                            className={cn(
                              'h-7 px-2.5 text-xs font-medium gap-1.5 transition-all',
                              isVisible
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            )}
                            aria-label={`Chuyển trạng thái hiển thị của ${cat.name}`}
                          >
                            {isToggling ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : isVisible ? (
                              <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <EyeOff className="size-3.5 text-muted-foreground" />
                            )}
                            <span>{isVisible ? 'Hiện trên WebGIS' : 'Ẩn trên WebGIS'}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isVisible
                            ? 'Nhấn để ẩn danh mục này khỏi thanh chọn lớp WebGIS'
                            : 'Nhấn để hiển thị lại danh mục này trên WebGIS'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={isDeleting || hasLayers}
                              onClick={() => setDeleteTarget(cat)}
                              className="text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:pointer-events-none"
                              aria-label={`Xóa danh mục ${cat.name}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {hasLayers
                            ? `Đang có ${layerCount} lớp bản đồ sử dụng, không thể xóa`
                            : `Xóa danh mục "${cat.name}"`}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Tạo danh mục mới */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm danh mục lớp mới</DialogTitle>
            <DialogDescription>
              Nhập tên danh mục chuẩn tiếng Việt. Mã nhận diện sẽ được tự động tạo từ tên.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-cat-name" className="text-xs font-semibold">
                Tên danh mục <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-cat-name"
                placeholder="VD: Hạ tầng cấp thoát nước"
                value={newCategoryName}
                maxLength={120}
                disabled={isCreating}
                onChange={(e) => {
                  setNewCategoryName(e.target.value)
                  if (createError) setCreateError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveCreate()
                  }
                }}
                autoFocus
              />
              {createError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{createError}</span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCreating}
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isCreating || !newCategoryName.trim()}
              onClick={handleSaveCreate}
              className="gap-1.5"
            >
              {isCreating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Tạo danh mục
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Xác nhận xóa danh mục */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa danh mục</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa danh mục{' '}
              <strong className="text-foreground">{deleteTarget?.name}</strong> (mã:{' '}
              <code>{deleteTarget?.key}</code>)? Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Xóa danh mục
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
