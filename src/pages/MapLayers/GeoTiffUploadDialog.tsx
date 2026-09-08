import { useState, useCallback, useMemo, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload'
import CategorySelect from '@/components/common/CategorySelect'
import { MAP_LAYER_CATEGORY_LABEL_VI, toCategorySlug } from '@/constant/mapLayerConstant'
import { cn } from '@/lib/utils'
import { mapLayerService, remoteSensingService, useApiQuery } from '@/service'
import storageService from '@/service/storageService'

interface GeoTiffUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublished: () => void
}

const toLayerCode = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63)
  return /^[a-z]/.test(normalized) ? normalized : `raster_${normalized || Date.now()}`
}

const toCoverageKey = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 80)
  return normalized || 'chuoi_thoi_gian'
}

const MAX_GEOTIFF_SIZE = 500 * 1024 * 1024 // 500MB

export default function GeoTiffUploadDialog({
  open,
  onOpenChange,
  onPublished,
}: GeoTiffUploadDialogProps) {
  const [uploadMode, setUploadMode] = useState<'time_series' | 'standalone'>('time_series')
  const [tiffFiles, setTiffFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [coverageKey, setCoverageKey] = useState('')
  const [category, setCategory] = useState('remote_sensing')
  const [categoryName, setCategoryName] = useState(() => MAP_LAYER_CATEGORY_LABEL_VI.remote_sensing || 'Ảnh viễn thám')
  const [platform, setPlatform] = useState('sentinel-2')
  const [acquiredAt, setAcquiredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [srid, setSrid] = useState('4326')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)

  const timeSeriesCatalogQuery = useApiQuery(
    ['webMap', 'timeSeriesLayers'],
    () => mapLayerService.getTimeSeriesCatalog(),
    { enabled: open && uploadMode === 'time_series', staleTime: 60000 }
  )

  const existingCoverageOptions = useMemo(() => {
    const raw = timeSeriesCatalogQuery.data as
      | { data?: Array<{ timeSeries?: { coverageKey?: string }; nameVi?: string; category?: string; categoryName?: string }> }
      | undefined
    const items = raw?.data ?? []
    const seen = new Set<string>()
    const result: Array<{ coverageKey: string; nameVi: string; category?: string; categoryName?: string }> = []
    items.forEach((layer) => {
      const key = layer.timeSeries?.coverageKey
      if (key && !seen.has(key)) {
        seen.add(key)
        result.push({
          coverageKey: key,
          nameVi: layer.nameVi || key,
          category: layer.category,
          categoryName: layer.categoryName,
        })
      }
    })
    return result
  }, [timeSeriesCatalogQuery.data])

  const reset = () => {
    setTiffFiles([])
    setTitle('')
    setCode('')
    setCoverageKey('')
    setCategory('remote_sensing')
    setCategoryName(MAP_LAYER_CATEGORY_LABEL_VI.remote_sensing || 'Ảnh viễn thám')
    setPlatform('sentinel-2')
    setAcquiredAt(new Date().toISOString().slice(0, 10))
    setSrid('4326')
    setIsPublic(false)
    setUploadMode('time_series')
  }

  const close = () => {
    if (saving) return
    onOpenChange(false)
  }

  const onFileValidate = useCallback((file: File): string | null => {
    if (!/\.(tif|tiff)$/i.test(file.name)) return 'Chỉ hỗ trợ tệp .tif hoặc .tiff.'
    if (file.size > MAX_GEOTIFF_SIZE) return 'Kích thước file không được quá 500MB'
    return null
  }, [])

  const onFileReject = useCallback((_file: File, message: string) => {
    toast.error(message)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const file = tiffFiles[0] ?? null
    if (!file) return toast.error('Vui lòng chọn tệp ảnh bản đồ.')
    if (!/\.(tif|tiff)$/i.test(file.name)) return toast.error('Chỉ hỗ trợ tệp .tif hoặc .tiff.')
    if (!title.trim()) return toast.error('Vui lòng nhập tên lớp bản đồ.')

    const finalCategory = (category === 'other' || !category)
      ? (toCategorySlug(categoryName) || 'other')
      : category
    if (!finalCategory || (finalCategory === 'other' && !categoryName.trim())) {
      return toast.error('Vui lòng chọn hoặc nhập tên danh mục hợp lệ.')
    }

    if (uploadMode === 'time_series') {
      const activeCoverageKey = toCoverageKey(coverageKey || code || title)
      if (!activeCoverageKey) return toast.error('Vui lòng nhập khóa nhóm chuỗi thời gian.')

      setSaving(true)
      try {
        const fileObjectId = await storageService.upload(file, 'raster')
        const sceneCode = `${activeCoverageKey}_${acquiredAt.replace(/[^0-9]/g, '')}_${Date.now()}`.slice(0, 100)
        const imageResponse = await remoteSensingService.createImage({
          sceneCode,
          title: title.trim(),
          platform,
          thematicGroup: finalCategory,
          coverageKey: activeCoverageKey,
          acquiredAt,
          productLevel: 'GeoTIFF',
          resolutionM: 1,
          cloudCoverPercent: 0,
          fileObjectId: Number(fileObjectId),
        })
        const imageId = Number(imageResponse.data?.id)
        if (!Number.isInteger(imageId) || imageId <= 0) throw new Error('Hệ thống chưa tạo hồ sơ ảnh bản đồ.')

        toast.success(`Đã thêm ảnh vào chuỗi thời gian "${activeCoverageKey}".`)
        reset()
        onPublished()
        onOpenChange(false)
      } catch (error: any) {
        const message = error?.response?.data?.message || error?.message || 'Không thể lưu ảnh vào chuỗi thời gian.'
        toast.error(message)
      } finally {
        setSaving(false)
      }
      return
    }

    const layerCode = toLayerCode(code || title)
    const activeCoverageKey = toCoverageKey(coverageKey) || layerCode
    const epsg = Number(srid)
    if (!Number.isInteger(epsg) || epsg < 1) return toast.error('Hệ tọa độ không hợp lệ.')

    setSaving(true)
    try {
      const fileObjectId = await storageService.upload(file, 'raster')
      const imageResponse = await remoteSensingService.createImage({
        sceneCode: `${layerCode}_${Date.now()}`.slice(0, 100),
        title: title.trim(),
        platform,
        thematicGroup: finalCategory,
        coverageKey: activeCoverageKey,
        acquiredAt,
        productLevel: 'GeoTIFF',
        resolutionM: 1,
        cloudCoverPercent: 0,
        fileObjectId: Number(fileObjectId),
      })
      const imageId = Number(imageResponse.data?.id)
      if (!Number.isInteger(imageId) || imageId <= 0) throw new Error('Hệ thống chưa tạo hồ sơ ảnh bản đồ.')

      const publishRes = await remoteSensingService.publishImage(imageId, {
        code: layerCode,
        nameVi: title.trim(),
        category: finalCategory,
        srid: epsg,
        minZoom: 0,
        maxZoom: 22,
        legendConfig: {},
        metadata: { source: 'admin_geotiff_upload', originalName: file.name },
        isPublic,
      })

      const publishedLayer = (publishRes.data as { layer?: { id?: number; updatedAt?: string; updated_at?: string } })?.layer
      const publishedLayerId = publishedLayer?.id
      if (publishedLayerId && categoryName.trim()) {
        try {
          let expectedUpdatedAt: string | undefined =
            (publishedLayer.updatedAt ?? publishedLayer.updated_at) || undefined
          if (!expectedUpdatedAt) {
            const detail = await mapLayerService.getById(publishedLayerId)
            expectedUpdatedAt = (detail.data?.updatedAt ?? detail.data?.updated_at) || undefined
          }
          if (expectedUpdatedAt) {
            await mapLayerService.patch(publishedLayerId, {
              expectedUpdatedAt,
              categoryName: categoryName.trim(),
            })
          }
        } catch (patchErr) {
          console.warn('Không thể cập nhật tên danh mục tiếng Việt:', patchErr)
          toast.warning('Đã công bố lớp bản đồ, nhưng chưa lưu được tên danh mục tiếng Việt.')
        }
      }

      toast.success('Đã tải lên tệp ảnh và công bố lớp bản đồ.')
      reset()
      onPublished()
      onOpenChange(false)
    } catch (error: any) {
      const errCode = error?.response?.data?.errors?.[0]
      const errMsg = error?.response?.data?.message
      if (errCode === 'RASTER_LAYER_CONFLICT' || errCode === 'LAYER_CODE_IN_USE_BY_OTHER_IMAGE') {
        toast.error(
          `Mã lớp độc lập "${layerCode}" đã tồn tại. Nếu bạn muốn gom nhiều mốc thời gian, hãy chọn mục "Thêm vào chuỗi thời gian" với cùng Khóa nhóm.`
        )
      } else {
        toast.error(errMsg || error?.message || 'Không thể xử lý tệp ảnh.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
        <DialogTitle>Thêm ảnh bản đồ GeoTIFF</DialogTitle>
        <DialogDescription>
          {uploadMode === 'time_series'
            ? 'Thêm ảnh vệ tinh vào kho dữ liệu để liên kết theo mốc thời gian và tổng hợp thành chuỗi.'
            : 'Tải lên và công bố ngay thành một lớp bản đồ độc lập trên WebGIS.'}
        </DialogDescription>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Mục đích tải lên</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setUploadMode('time_series')}
                disabled={saving}
                className={cn(
                  'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                  uploadMode === 'time_series'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-sm font-semibold text-foreground">Thêm vào chuỗi thời gian</span>
                <span className="text-xs text-muted-foreground">
                  Dùng chung khóa nhóm với các mốc khác. Không tạo lớp bản đồ độc lập.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('standalone')}
                disabled={saving}
                className={cn(
                  'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                  uploadMode === 'standalone'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-sm font-semibold text-foreground">Công bố lớp độc lập</span>
                <span className="text-xs text-muted-foreground">
                  Công bố ngay thành một lớp riêng biệt trên WebGIS với mã lớp duy nhất.
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Tệp ảnh bản đồ <span className="text-destructive">*</span>
            </Label>
            <FileUpload
              label="Tệp ảnh bản đồ *"
              value={tiffFiles}
              onValueChange={setTiffFiles}
              onFileValidate={onFileValidate}
              onFileReject={onFileReject}
              accept=".tif,.tiff,image/tiff"
              maxFiles={1}
              maxSize={MAX_GEOTIFF_SIZE}
              disabled={saving}
            >
              <FileUploadDropzone className="border-dashed p-4 sm:p-6">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Layers className="text-muted-foreground size-6" />
                  <p className="text-sm font-medium">Kéo thả tệp ảnh bản đồ (.tif) vào đây</p>
                  <p className="text-muted-foreground text-xs">hoặc</p>
                  <FileUploadTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={saving}>
                      Chọn tệp ảnh
                    </Button>
                  </FileUploadTrigger>
                  <p className="text-muted-foreground text-xs">Hỗ trợ .tif, .tiff · Tối đa 500MB</p>
                </div>
              </FileUploadDropzone>
              <FileUploadList>
                {tiffFiles.map((f) => (
                  <FileUploadItem key={f.name} value={f}>
                    <FileUploadItemPreview />
                    <FileUploadItemMetadata />
                    <FileUploadItemDelete asChild>
                      <Button type="button" variant="ghost" size="sm" disabled={saving} className="shrink-0">
                        Xóa
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                ))}
              </FileUploadList>
            </FileUpload>
          </div>

          <div className="space-y-2">
            <Label htmlFor="geotiff-title">
              {uploadMode === 'time_series' ? 'Tên lớp / mốc thời gian' : 'Tên lớp'}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="geotiff-title"
              value={title}
              disabled={saving}
              placeholder={uploadMode === 'time_series' ? 'vd: Lớp phủ đô thị Cẩm Phả năm 2018' : 'vd: Lớp ngập lụt năm 2018'}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {uploadMode === 'time_series' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="geotiff-coverage-key">
                  Khóa nhóm Time Series (coverage_key) <span className="text-destructive">*</span>
                </Label>
                {existingCoverageOptions.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Có {existingCoverageOptions.length} chuỗi trong hệ thống
                  </span>
                )}
              </div>
              <Input
                id="geotiff-coverage-key"
                list="existing-coverage-keys-list"
                value={coverageKey}
                disabled={saving}
                placeholder="vd: cam-pha-lop-phu-do-thi"
                onChange={(event) => setCoverageKey(toCoverageKey(event.target.value))}
              />
              <datalist id="existing-coverage-keys-list">
                {existingCoverageOptions.map((opt) => (
                  <option key={opt.coverageKey} value={opt.coverageKey}>
                    {opt.nameVi}
                  </option>
                ))}
              </datalist>

              {existingCoverageOptions.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <span className="text-xs text-muted-foreground block">
                    Gợi ý chuỗi đã có (bấm để tự điền khóa và danh mục):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {existingCoverageOptions.map((opt) => (
                      <button
                        key={opt.coverageKey}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setCoverageKey(opt.coverageKey)
                          if (opt.category) setCategory(opt.category)
                          if (opt.categoryName) setCategoryName(opt.categoryName)
                        }}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-mono transition-colors text-left',
                          coverageKey === opt.coverageKey
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-muted-foreground/20 bg-muted/40 hover:bg-muted text-foreground'
                        )}
                      >
                        {opt.coverageKey}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Tất cả các ảnh thuộc cùng một chuỗi thời gian phải dùng chung khóa này và có ngày thu nhận riêng biệt.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="geotiff-code">
                    Mã lớp độc lập <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="geotiff-code"
                    value={code}
                    disabled={saving}
                    placeholder="vd: lop_phu_2018"
                    onChange={(event) => setCode(toLayerCode(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geotiff-epsg">
                    Hệ tọa độ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="geotiff-epsg"
                    inputMode="numeric"
                    placeholder="4326"
                    value={srid}
                    disabled={saving}
                    onChange={(event) => setSrid(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="geotiff-standalone-coverage-key" className="text-xs font-medium">
                    Khóa chuỗi thời gian (coverage_key) — Tùy chọn gộp nhóm sau này
                  </Label>
                </div>
                <Input
                  id="geotiff-standalone-coverage-key"
                  list="existing-coverage-keys-list"
                  value={coverageKey}
                  disabled={saving}
                  placeholder="Để trống nếu không gộp (hoặc vd: cam-pha-lop-phu-do-thi)"
                  onChange={(event) => setCoverageKey(toCoverageKey(event.target.value))}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nếu ảnh này là một mốc trong chuỗi thời gian, chọn hoặc nhập khóa chuỗi tại đây. Lớp vẫn xuất bản độc lập bình thường nhưng sẵn sàng gộp vào chuỗi sau này.
                </p>
                {existingCoverageOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto">
                    {existingCoverageOptions.map((opt) => (
                      <button
                        key={opt.coverageKey}
                        type="button"
                        disabled={saving}
                        onClick={() => setCoverageKey(opt.coverageKey)}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[11px] font-mono transition-colors',
                          coverageKey === opt.coverageKey
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-muted-foreground/20 bg-muted/40 hover:bg-muted text-foreground'
                        )}
                      >
                        {opt.coverageKey}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <CategorySelect
              category={category}
              categoryName={categoryName}
              onCategoryChange={setCategory}
              onCategoryNameChange={setCategoryName}
              disabled={saving}
              label="Danh mục"
              required
              id="geotiff-category"
            />
            <div className="space-y-2">
              <Label>
                Nguồn ảnh <span className="text-destructive">*</span>
              </Label>
              <Select value={platform} onValueChange={setPlatform} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sentinel-1">Sentinel-1</SelectItem>
                  <SelectItem value="sentinel-2">Sentinel-2</SelectItem>
                  <SelectItem value="landsat-7">Landsat-7</SelectItem>
                  <SelectItem value="landsat-8">Landsat-8</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="geotiff-date">
                Ngày thu nhận <span className="text-destructive">*</span>
              </Label>
              <Input
                id="geotiff-date"
                type="date"
                value={acquiredAt}
                disabled={saving}
                onChange={(event) => setAcquiredAt(event.target.value)}
              />
            </div>
            {uploadMode === 'standalone' ? (
              <label className="flex h-10 items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPublic}
                  disabled={saving}
                  onChange={(event) => setIsPublic(event.target.checked)}
                />
                Công khai trên WebGIS
              </label>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving} onClick={close} className="w-full sm:w-auto">
              Hủy
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Đang xử lý…' : uploadMode === 'time_series' ? 'Lưu vào chuỗi thời gian' : 'Tải lên và công bố'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
