import type { JSX } from 'react'
import { useState, useRef, useEffect } from 'react'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { hasPerm, hasAnyPerm } from '@/lib/permissions'
import { useSourceImages } from './useSourceImages'
import { SourceImagesTable } from './SourceImagesTable'
import {
  RepublishLayerDialog,
  ChangeCoverageKeyDialog,
  CleanupDetailDialog,
  DeleteSourceImageDialog,
} from './SourceImageActions'
import GeoTiffUploadDialog from '@/pages/MapLayers/GeoTiffUploadDialog'
import type { SatelliteImageMember } from '@/types/api'
import type { ListSatelliteImagesParams } from '@/service/remoteSensingService'
import { ShieldAlert, Upload } from 'lucide-react'

export default function SourceImagesPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const isSystemAdmin = user?.role?.code === 'system_admin' || user?.roleCode === 'system_admin'
  const canRead = hasPerm(user, 'raster', 'read') || isSystemAdmin
  const canCreate = hasPerm(user, 'raster', 'create') || isSystemAdmin
  const canPublish =
    (hasAnyPerm(user, 'raster', ['create', 'categorize', 'update']) || isSystemAdmin) &&
    (hasPerm(user, 'layers', 'create') || isSystemAdmin)
  const canUpdate =
    hasAnyPerm(user, 'raster', ['create', 'categorize', 'update']) || isSystemAdmin
  const canDelete = hasPerm(user, 'raster', 'delete') || isSystemAdmin
  const canRetryCleanup =
    hasPerm(user, 'layers', 'delete') ||
    hasPerm(user, 'layers', 'update') ||
    isSystemAdmin

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [statusFilter, setStatusFilter] =
    useState<NonNullable<ListSatelliteImagesParams['status']>>('all')

  // Server-side status filtering now deployed on apicampha.tourismpj.pro.vn
  const queryParams: ListSatelliteImagesParams = {
    page: currentPage,
    limit,
    ...(searchValue ? { q: searchValue } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const { items, total, isLoading, refetch } = useSourceImages(queryParams)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const lastTotalPagesRef = useRef(1)
  lastTotalPagesRef.current = totalPages

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Dialog states
  const [uploadOpen, setUploadOpen] = useState(false)

  const [selectedImageForRepublish, setSelectedImageForRepublish] =
    useState<SatelliteImageMember | null>(null)
  const [republishOpen, setRepublishOpen] = useState(false)

  const [selectedImageForChangeKey, setSelectedImageForChangeKey] =
    useState<SatelliteImageMember | null>(null)
  const [changeKeyOpen, setChangeKeyOpen] = useState(false)

  const [selectedImageForDelete, setSelectedImageForDelete] =
    useState<SatelliteImageMember | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [selectedLayerIdForCleanup, setSelectedLayerIdForCleanup] = useState<
    number | string | null
  >(null)
  const [cleanupOpen, setCleanupOpen] = useState(false)

  if (!canRead) {
    return (
      <PageLayout title="Kho ảnh nguồn GeoTIFF" description="Quản lý tệp ảnh viễn thám gốc">
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <ShieldAlert className="size-10 text-destructive/70" />
          <p className="text-sm font-medium">
            Bạn không có quyền truy cập kho ảnh nguồn (yêu cầu quyền raster:read).
          </p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Kho ảnh nguồn GeoTIFF"
      description="Quản lý tệp ảnh viễn thám gốc, theo dõi trạng thái dọn dẹp lớp đã xóa, đổi nhóm chuỗi thời gian hoặc công bố lại thành lớp bản đồ mới."
    >
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={(val) => {
          setSearchValue(val)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as NonNullable<ListSatelliteImagesParams['status']>)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Trạng thái ảnh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="in_use">Đang có lớp sử dụng</SelectItem>
                <SelectItem value="unpublished">Chưa công bố / Đã xóa lớp</SelectItem>
                <SelectItem value="standalone">Lớp đơn độc lập</SelectItem>
                <SelectItem value="time_series">Chuỗi thời gian</SelectItem>
                <SelectItem value="cleanup_pending">Đang dọn dẹp lớp</SelectItem>
                <SelectItem value="cleanup_failed">Dọn dẹp thất bại</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${limit}`}
              onValueChange={(val) => {
                setLimit(parseInt(val, 10))
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadOpen(true)}
                className="gap-1.5"
              >
                <Upload className="size-3.5" />
                Tải lên tệp TIFF
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
        <SourceImagesTable
          items={items}
          loading={isLoading}
          canPublish={canPublish}
          canCreate={canUpdate}
          canDelete={canDelete}
          onRepublish={(image) => {
            setSelectedImageForRepublish(image)
            setRepublishOpen(true)
          }}
          onChangeGroup={(image) => {
            setSelectedImageForChangeKey(image)
            setChangeKeyOpen(true)
          }}
          onViewCleanup={(layerId) => {
            setSelectedLayerIdForCleanup(layerId)
            setCleanupOpen(true)
          }}
          onDelete={(image) => {
            setSelectedImageForDelete(image)
            setDeleteOpen(true)
          }}
        />
      </ToolTableCustom>

      {/* Action Dialogs */}
      <GeoTiffUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onPublished={() => refetch()}
      />

      <RepublishLayerDialog
        image={selectedImageForRepublish}
        open={republishOpen}
        onOpenChange={(open) => {
          setRepublishOpen(open)
          if (!open) setSelectedImageForRepublish(null)
        }}
        onSuccess={() => refetch()}
      />

      <ChangeCoverageKeyDialog
        image={selectedImageForChangeKey}
        open={changeKeyOpen}
        onOpenChange={(open) => {
          setChangeKeyOpen(open)
          if (!open) setSelectedImageForChangeKey(null)
        }}
        onSuccess={() => refetch()}
      />

      <CleanupDetailDialog
        layerId={selectedLayerIdForCleanup}
        open={cleanupOpen}
        onOpenChange={(open) => {
          setCleanupOpen(open)
          if (!open) setSelectedLayerIdForCleanup(null)
        }}
        canRetryPerm={canRetryCleanup}
        onSuccess={() => refetch()}
      />

      <DeleteSourceImageDialog
        image={selectedImageForDelete}
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setSelectedImageForDelete(null)
        }}
        onSuccess={() => refetch()}
      />
    </PageLayout>
  )
}
