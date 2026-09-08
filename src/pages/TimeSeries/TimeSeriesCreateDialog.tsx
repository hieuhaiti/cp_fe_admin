import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  FolderInput,
  Info,
  Layers3,
  Loader2,
  Search,
  ServerCog,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getMapLayerCategoryLabel, toCategorySlug } from '@/constant/mapLayerConstant'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { mapLayerService, remoteSensingService, useApiQuery } from '@/service'
import type { SatelliteImageListData, SatelliteImageMember } from '@/types/api'
import {
  createTimeSeriesCollectionFormSchema,
  type CreateTimeSeriesCollectionFormInput,
  type CreateTimeSeriesCollectionFormValues,
} from './timeSeriesSchema'

interface TimeSeriesCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface ExistingCoverageGroup {
  coverageKey: string
  displayName: string
  category: string
  categoryName: string
  platformNames: string[]
  dates: string[]
  duplicateDates: string[]
  duplicateImageCount: number
  invalidDateCount: number
  isPublishable: boolean
  images: SatelliteImageMember[]
}

const toLayerCode = (coverageKey: string) => {
  const normalized = coverageKey
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const prefixed = /^[a-z]/.test(normalized) ? normalized : `ts_${normalized}`
  const base = prefixed.endsWith('_ts') ? prefixed.slice(0, 63) : `${prefixed.slice(0, 60)}_ts`
  return base.slice(0, 63)
}

const toCoverageKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

const cleanTitle = (title: string, coverageKey: string) => {
  const withoutDate = title
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/[()[\]_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (withoutDate) return withoutDate
  return coverageKey
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const normalizeImages = (
  data: SatelliteImageMember[] | SatelliteImageListData | undefined
): SatelliteImageMember[] => (Array.isArray(data) ? data : (data?.items ?? []))

export default function TimeSeriesCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TimeSeriesCreateDialogProps) {
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<ExistingCoverageGroup | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<number | string | null>(null)
  const [showMergeBox, setShowMergeBox] = useState(false)
  const [targetMergeKey, setTargetMergeKey] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  const form = useForm<
    CreateTimeSeriesCollectionFormInput,
    unknown,
    CreateTimeSeriesCollectionFormValues
  >({
    resolver: zodResolver(createTimeSeriesCollectionFormSchema),
    defaultValues: {
      coverageKey: '',
      code: '',
      nameVi: '',
      category: 'remote_sensing',
      categoryName: 'Ảnh viễn thám',
      srid: 32648,
      minZoom: 0,
      maxZoom: 22,
      isPublic: false,
    },
  })

  const existingImagesQuery = useApiQuery(
    ['admin', 'remoteSensing', 'imagesForTimeSeries'],
    () => remoteSensingService.listImages({ limit: 100, sort: 'acquiredAt:asc' }),
    { enabled: open, staleTime: 30000 }
  )

  const groups = useMemo<ExistingCoverageGroup[]>(() => {
    const images = normalizeImages(existingImagesQuery.data?.data)
    const grouped = new Map<string, SatelliteImageMember[]>()

    images.forEach((image) => {
      if (!image.coverage_key) return
      const members = grouped.get(image.coverage_key) ?? []
      members.push(image)
      grouped.set(image.coverage_key, members)
    })

    return Array.from(grouped.entries())
      .map(([coverageKey, members]) => {
        const orderedMembers = [...members].sort(
          (left, right) =>
            new Date(left.acquired_at).getTime() - new Date(right.acquired_at).getTime()
        )
        const thematicGroup = orderedMembers.find((item) => item.thematic_group)?.thematic_group
        const category = toCategorySlug(thematicGroup || '') || 'remote_sensing'
        const categoryName = thematicGroup
          ? getMapLayerCategoryLabel(thematicGroup)
          : 'Ảnh viễn thám'
        const firstTitle = orderedMembers.find((item) => item.title)?.title || ''
        const dateCounts = new Map<string, number>()
        let invalidDateCount = 0

        orderedMembers.forEach((item) => {
          const acquiredAt = new Date(item.acquired_at)
          if (!Number.isFinite(acquiredAt.getTime())) {
            invalidDateCount += 1
            return
          }
          const canonicalDate = acquiredAt.toISOString()
          dateCounts.set(canonicalDate, (dateCounts.get(canonicalDate) ?? 0) + 1)
        })

        const dates = Array.from(dateCounts.keys()).sort(
          (left, right) => new Date(left).getTime() - new Date(right).getTime()
        )
        const duplicateDates = Array.from(dateCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([date]) => date)
        const duplicateImageCount = Array.from(dateCounts.values()).reduce(
          (total, count) => total + Math.max(0, count - 1),
          0
        )

        return {
          coverageKey,
          displayName: thematicGroup
            ? getMapLayerCategoryLabel(thematicGroup)
            : cleanTitle(firstTitle, coverageKey),
          category,
          categoryName,
          platformNames: [...new Set(orderedMembers.map((item) => item.platform).filter(Boolean))],
          dates,
          duplicateDates,
          duplicateImageCount,
          invalidDateCount,
          isPublishable: duplicateDates.length === 0 && invalidDateCount === 0 && dates.length > 1,
          images: orderedMembers,
        }
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'vi'))
  }, [existingImagesQuery.data])

  const relevantGroups = useMemo(
    () => (showAllGroups ? groups : groups.filter((group) => group.images.length > 1)),
    [groups, showAllGroups]
  )

  const hiddenSingleImageCount = groups.length - groups.filter((group) => group.images.length > 1).length

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi')
    if (!query) return relevantGroups
    return relevantGroups.filter((group) =>
      [
        group.displayName,
        group.categoryName,
        group.coverageKey,
        ...group.platformNames,
        ...group.images.flatMap((image) => [image.scene_code, image.title]),
      ].some((value) => value.toLocaleLowerCase('vi').includes(query))
    )
  }, [relevantGroups, searchQuery])

  const selectGroup = (group: ExistingCoverageGroup) => {
    setShowMergeBox(false)
    setTargetMergeKey('')
    const firstYear = group.dates[0] ? new Date(group.dates[0]).getUTCFullYear() : null
    const latestDate = group.dates.at(-1)
    const latestYear = latestDate ? new Date(latestDate).getUTCFullYear() : null
    const range = firstYear && latestYear
      ? firstYear === latestYear
        ? `${firstYear}`
        : `${firstYear}-${latestYear}`
      : ''

    setSelectedGroup(group)
    form.reset({
      coverageKey: group.coverageKey,
      code: toLayerCode(group.coverageKey),
      nameVi: range ? `${group.displayName} (${range})` : group.displayName,
      category: group.category,
      categoryName: group.categoryName,
      srid: 32648,
      minZoom: 0,
      maxZoom: 22,
      isPublic: false,
    })
  }

  const handleMergeGroup = async () => {
    if (!selectedGroup) return
    const target = toCoverageKey(targetMergeKey)
    if (!target) {
      toast.error('Vui lòng chọn hoặc nhập nhóm đích.')
      return
    }
    if (target === selectedGroup.coverageKey) {
      toast.error('Nhóm đích phải khác nhóm nguồn hiện tại.')
      return
    }
    setIsMerging(true)
    try {
      await remoteSensingService.mergeCollections([selectedGroup.coverageKey], target)
      toast.success(`Đã gộp nhóm "${selectedGroup.coverageKey}" vào nhóm "${target}".`)
      setShowMergeBox(false)
      setTargetMergeKey('')
      setSelectedGroup(null)
      await existingImagesQuery.refetch()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể gộp nhóm ảnh'
      toast.error(message)
    } finally {
      setIsMerging(false)
    }
  }

  const handleDeleteImage = async (image: SatelliteImageMember) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ảnh "${image.title || image.scene_code}" (ID: ${image.id})?`)) {
      return
    }
    setDeletingImageId(image.id)
    try {
      await remoteSensingService.deleteImage(image.id, image.updated_at, false)
      toast.success(`Đã xóa ảnh #${image.id}`)
      setSelectedGroup(null)
      await existingImagesQuery.refetch()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể xóa ảnh'
      toast.error(message)
    } finally {
      setDeletingImageId(null)
    }
  }

  const onSubmit = async (values: CreateTimeSeriesCollectionFormValues) => {
    if (!selectedGroup) {
      toast.error('Vui lòng chọn nhóm dữ liệu cần tổng hợp thành chuỗi thời gian')
      return
    }
    if (!selectedGroup.isPublishable) {
      toast.error('Nhóm dữ liệu có mốc thu nhận bị trùng hoặc không hợp lệ')
      return
    }

    try {
      const publishResponse = await remoteSensingService.publishCollection(values.coverageKey, {
        code: values.code,
        nameVi: values.nameVi,
        category: values.category,
        srid: values.srid,
        minZoom: values.minZoom,
        maxZoom: values.maxZoom,
        isPublic: values.isPublic,
      })

      const publishedLayer = publishResponse.data?.layer
      if (publishedLayer?.id && values.categoryName?.trim()) {
        try {
          let expectedUpdatedAt = publishedLayer.updatedAt ?? publishedLayer.updated_at ?? undefined
          if (!expectedUpdatedAt) {
            const detail = await mapLayerService.getById(publishedLayer.id)
            expectedUpdatedAt = detail.data?.updatedAt ?? detail.data?.updated_at ?? undefined
          }
          if (typeof expectedUpdatedAt === 'string' && expectedUpdatedAt.length > 0) {
            await mapLayerService.patch(publishedLayer.id, {
              expectedUpdatedAt,
              categoryName: values.categoryName.trim(),
            })
          }
        } catch {
          toast.warning(
            'Đã công bố chuỗi thời gian nhưng chưa lưu được tên hiển thị của nhóm dữ liệu.'
          )
        }
      }

      toast.success('Đã tổng hợp và công bố lớp chuỗi thời gian thành công!')
      setSelectedGroup(null)
      setSearchQuery('')
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message ||
        'Không thể tổng hợp lớp chuỗi thời gian'
      toast.error(message)
    }
  }

  const latestTime = selectedGroup?.dates.at(-1)
  const publishableGroupCount = relevantGroups.filter((group) => group.isPublishable).length
  const problematicGroupCount = relevantGroups.length - publishableGroupCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100dvw-2rem)] max-w-5xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Tạo lớp dữ liệu chuỗi thời gian</DialogTitle>
              <DialogDescription>
                Chọn một nhóm dữ liệu; hệ thống tự động gom các ảnh cùng nhóm thành một chuỗi theo thời gian.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
        >
          <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
            <div className="flex min-h-0 flex-col gap-3">
              <div className="space-y-1">
                <Label htmlFor="time-series-group-search" className="text-base font-semibold">
                  Nhóm dữ liệu chuỗi thời gian <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Chỉ hiển thị nhóm có từ 2 ảnh trở lên, vì chuỗi thời gian cần nhiều mốc thu nhận. Quản lý ảnh đơn lẻ tại{' '}
                  <a
                    href="/map-layers/source-images"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:text-primary/80 font-medium"
                  >
                    Kho ảnh nguồn GeoTIFF
                  </a>.
                </p>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
                <div className="flex shrink-0 items-center gap-2 border-b px-3">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="time-series-group-search"
                    aria-label="Tìm kiếm nhóm dữ liệu chuỗi thời gian"
                    placeholder="Tìm theo tên hoặc khóa nhóm…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Xóa nội dung tìm kiếm"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>

                {!existingImagesQuery.isLoading && !existingImagesQuery.isError && (
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span>{relevantGroups.length} nhóm dữ liệu</span>
                    {publishableGroupCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 text-primary" />
                        {publishableGroupCount} sẵn sàng
                      </span>
                    )}
                    {problematicGroupCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="size-3.5" />
                        {problematicGroupCount} cần kiểm tra
                      </span>
                    )}
                    {hiddenSingleImageCount > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="ml-auto h-auto p-0 text-xs"
                        onClick={() => setShowAllGroups((previous) => !previous)}
                      >
                        {showAllGroups
                          ? 'Ẩn nhóm chỉ có 1 ảnh'
                          : `Hiện ${hiddenSingleImageCount} nhóm chỉ có 1 ảnh`}
                      </Button>
                    )}
                  </div>
                )}

                <div
                  role="listbox"
                  aria-label="Danh sách nhóm dữ liệu chuỗi thời gian"
                  tabIndex={0}
                  style={{ touchAction: 'pan-y' }}
                  className="min-h-72 h-80 max-h-96 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                >
                  {existingImagesQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Đang tải các nhóm dữ liệu…
                    </div>
                  ) : existingImagesQuery.isError ? (
                    <div className="py-10 text-center text-sm text-destructive">
                      Không thể tải danh sách nhóm dữ liệu. Vui lòng thử lại.
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Không có nhóm dữ liệu phù hợp.
                    </div>
                  ) : (
                    filteredGroups.map((group) => {
                      const isSelected = selectedGroup?.coverageKey === group.coverageKey
                      const firstTime = group.dates[0]
                      const lastTime = group.dates.at(-1)
                      return (
                        <button
                          key={group.coverageKey}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          aria-label={`Chọn nhóm ${group.coverageKey}`}
                          onClick={() => selectGroup(group)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:bg-muted/60'
                          }`}
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">
                              {group.coverageKey}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {group.images.length} ảnh · {group.dates.length} mốc
                              {firstTime && lastTime
                                ? ` · ${new Date(firstTime).getUTCFullYear()}–${new Date(lastTime).getUTCFullYear()}`
                                : ''}
                            </span>
                          </span>
                          {!group.isPublishable && (
                            <Badge variant="destructive" className="shrink-0 gap-1 text-[10px]">
                              <AlertTriangle className="size-3" />
                              Trùng mốc
                            </Badge>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {form.formState.errors.coverageKey && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.coverageKey.message}
                </p>
              )}

              {selectedGroup && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-muted-foreground">
                      Khóa nhóm: <strong className="font-mono text-foreground">{selectedGroup.coverageKey}</strong>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowMergeBox((prev) => !prev)}
                    >
                      <FolderInput className="size-3.5" />
                      {showMergeBox ? 'Đóng gộp nhóm' : 'Gộp vào nhóm khác…'}
                    </Button>
                  </div>

                  {showMergeBox && (
                    <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          Gộp tất cả {selectedGroup.images.length} ảnh của nhóm này vào nhóm chuỗi khác:
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-5 p-0"
                          onClick={() => setShowMergeBox(false)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Các ảnh thuộc nhóm "{selectedGroup.coverageKey}" sẽ được đổi khóa chuỗi sang nhóm đích để cùng tổng hợp. Lớp bản đồ độc lập (nếu có) vẫn hoạt động bình thường.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          list="available-merge-target-groups"
                          value={targetMergeKey}
                          onChange={(e) => setTargetMergeKey(toCoverageKey(e.target.value))}
                          placeholder="Chọn hoặc nhập khóa nhóm đích"
                          className="h-8 text-xs font-mono flex-1 bg-background"
                          disabled={isMerging}
                        />
                        <datalist id="available-merge-target-groups">
                          {groups
                            .filter((g) => g.coverageKey !== selectedGroup.coverageKey)
                            .map((g) => (
                              <option key={g.coverageKey} value={g.coverageKey}>
                                {g.coverageKey} ({g.images.length} ảnh)
                              </option>
                            ))}
                        </datalist>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          disabled={!targetMergeKey.trim() || isMerging}
                          onClick={handleMergeGroup}
                        >
                          {isMerging ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <FolderInput className="mr-1 size-3.5" />
                          )}
                          Xác nhận gộp
                        </Button>
                      </div>
                      {groups.filter((g) => g.coverageKey !== selectedGroup.coverageKey).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5 max-h-16 overflow-y-auto">
                          {groups
                            .filter((g) => g.coverageKey !== selectedGroup.coverageKey)
                            .map((g) => (
                              <button
                                key={g.coverageKey}
                                type="button"
                                disabled={isMerging}
                                onClick={() => setTargetMergeKey(g.coverageKey)}
                                className={cn(
                                  'rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors text-left',
                                  targetMergeKey === g.coverageKey
                                    ? 'border-primary bg-primary/20 text-primary font-bold'
                                    : 'border-muted-foreground/20 bg-background hover:bg-muted text-foreground'
                                )}
                              >
                                {g.coverageKey} ({g.images.length} ảnh)
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedGroup.images.length === 1 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                        <Info className="size-4" />
                        Nhóm chỉ có 1 ảnh mốc thời gian
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Một chuỗi thời gian cần tối thiểu 2 mốc để xem tua tiến trình. Bạn có thể bấm nút <strong>"Gộp vào nhóm khác"</strong> ở trên để ghép ảnh này vào một chuỗi đã có.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 rounded-xl border bg-card p-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="time-series-name-vi" className="text-xs font-semibold">
                          Tên lớp hiển thị <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="time-series-name-vi"
                          {...form.register('nameVi')}
                          placeholder="vd: Lớp phủ đô thị Cẩm Phả"
                          className="h-9 text-xs"
                        />
                        {form.formState.errors.nameVi && (
                          <p className="text-[11px] text-destructive">
                            {form.formState.errors.nameVi.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="time-series-layer-code" className="text-xs font-semibold">
                          Mã lớp chuỗi thời gian (code) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="time-series-layer-code"
                          {...form.register('code')}
                          placeholder="vd: lop_phu_do_thi_ts"
                          className="h-9 font-mono text-xs"
                        />
                        {form.formState.errors.code ? (
                          <p className="text-[11px] text-destructive">
                            {form.formState.errors.code.message}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Định danh trên GeoServer. Có thể chỉnh sửa (vd: thêm _v2) nếu mã cũ đã bị xóa.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {!selectedGroup.isPublishable && (
                    <div
                      role="alert"
                      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <div className="space-y-1">
                          <p className="font-semibold text-destructive">Chưa thể tổng hợp nhóm này</p>
                          {selectedGroup.duplicateDates.length > 0 && (
                            <p className="text-muted-foreground text-xs">
                              Có {selectedGroup.duplicateImageCount} ảnh dư tại {selectedGroup.duplicateDates.length} mốc trùng lặp. Mỗi mốc thời gian chỉ được giữ 1 ảnh duy nhất.
                            </p>
                          )}
                          {selectedGroup.invalidDateCount > 0 && (
                            <p className="text-muted-foreground text-xs">
                              Có {selectedGroup.invalidDateCount} ảnh có ngày thu nhận không hợp lệ.
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedGroup.duplicateDates.length > 0 && (
                        <div className="space-y-2 rounded-md border border-destructive/20 bg-background/80 p-2.5">
                          <span className="text-xs font-semibold text-foreground block">
                            Các ảnh bị trùng mốc (bấm nút để xóa ảnh thừa):
                          </span>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedGroup.duplicateDates.map((dupDate) => {
                              const conflictImages = selectedGroup.images.filter(
                                (img) => new Date(img.acquired_at).toISOString() === dupDate
                              )
                              return (
                                <div key={dupDate} className="space-y-1.5 rounded border p-2 bg-muted/20">
                                  <span className="text-[11px] font-medium text-destructive block">
                                    Mốc {formatDateTime(dupDate)} ({conflictImages.length} ảnh):
                                  </span>
                                  <div className="space-y-1">
                                    {conflictImages.map((img) => (
                                      <div
                                        key={img.id}
                                        className="flex items-center justify-between gap-2 rounded bg-card px-2.5 py-1.5 text-xs"
                                      >
                                        <div className="min-w-0 flex-1 truncate">
                                          <span className="font-mono text-muted-foreground mr-1.5 font-semibold">#{img.id}</span>
                                          <span className="font-medium text-foreground">{img.title || img.scene_code}</span>
                                          {img.original_name && (
                                            <span className="text-muted-foreground text-[10px] block truncate">
                                              {img.original_name}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="h-7 px-2 text-xs shrink-0"
                                          disabled={deletingImageId === img.id}
                                          onClick={() => handleDeleteImage(img)}
                                        >
                                          {deletingImageId === img.id ? (
                                            <Loader2 className="size-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Trash2 className="mr-1 size-3" />
                                              Xóa ảnh
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <span className="text-xs text-muted-foreground">Ảnh cùng khóa nhóm</span>
                      <strong className="mt-1 block text-lg">{selectedGroup.images.length}</strong>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <span className="text-xs text-muted-foreground">Mốc thời gian duy nhất</span>
                      <strong className="mt-1 block text-lg">{selectedGroup.dates.length}</strong>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <span className="text-xs text-muted-foreground">Mốc mặc định</span>
                      <strong className="mt-1 block text-sm">
                        {latestTime ? formatDateTime(latestTime) : 'Chưa xác định'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="h-fit space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="flex items-start gap-2.5">
                <ServerCog className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Hệ thống gom toàn bộ ảnh cùng khóa nhóm và sắp xếp theo ngày thu nhận.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Mốc mặc định là ảnh có ngày thu nhận mới nhất.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Muốn thêm mốc? Tải ảnh vào cùng khóa nhóm tại Kho ảnh viễn thám rồi công bố lại.
                </p>
              </div>
            </aside>
          </section>

          {selectedGroup && selectedGroup.dates.length > 0 && (
            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">Các mốc sẽ được tổng hợp</h3>
                <Badge variant="outline">{selectedGroup.dates.length} mốc</Badge>
              </div>
              <div className="grid max-h-40 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2 lg:grid-cols-4">
                {selectedGroup.dates.map((date, index) => (
                  <div
                    key={date}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs"
                  >
                    <span>{formatDateTime(date)}</span>
                    {index === selectedGroup.dates.length - 1 && (
                      <Badge className="ml-2 text-[10px]">Mặc định</Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Hủy
            </Button>
            <Button
              id="publish-time-series-group-button"
              type="submit"
              disabled={!selectedGroup || !selectedGroup.isPublishable || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Server đang tổng hợp…
                </>
              ) : (
                <>
                  <Layers3 className="mr-2 size-4" />
                  Tổng hợp và công bố
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
