import { useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAP_LAYER_CATEGORY_OPTIONS } from '@/constant/mapLayerConstant'
import { remoteSensingService } from '@/service'
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

export default function GeoTiffUploadDialog({
  open,
  onOpenChange,
  onPublished,
}: GeoTiffUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [category, setCategory] = useState('remote_sensing')
  const [platform, setPlatform] = useState('sentinel-2')
  const [acquiredAt, setAcquiredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [srid, setSrid] = useState('4326')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setFile(null)
    setTitle('')
    setCode('')
    setCategory('remote_sensing')
    setPlatform('sentinel-2')
    setAcquiredAt(new Date().toISOString().slice(0, 10))
    setSrid('4326')
    setIsPublic(false)
  }

  const close = () => {
    if (saving) return
    onOpenChange(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const layerCode = toLayerCode(code || title)
    const epsg = Number(srid)
    if (!file) return toast.error('Vui lòng chọn tệp GeoTIFF.')
    if (!/\.(tif|tiff)$/i.test(file.name)) return toast.error('Chỉ hỗ trợ tệp .tif hoặc .tiff.')
    if (!title.trim()) return toast.error('Vui lòng nhập tên lớp bản đồ.')
    if (!Number.isInteger(epsg) || epsg < 1) return toast.error('Mã EPSG không hợp lệ.')

    setSaving(true)
    try {
      const fileObjectId = await storageService.upload(file, 'raster')
      const imageResponse = await remoteSensingService.createImage({
        sceneCode: `${layerCode}_${Date.now()}`,
        title: title.trim(),
        platform,
        thematicGroup: category,
        coverageKey: layerCode,
        acquiredAt,
        productLevel: 'GeoTIFF',
        resolutionM: 1,
        cloudCoverPercent: 0,
        fileObjectId,
      })
      const imageId = imageResponse.data?.id
      if (!imageId) throw new Error('Máy chủ chưa tạo hồ sơ GeoTIFF.')

      await remoteSensingService.publishImage(imageId, {
        code: layerCode,
        nameVi: title.trim(),
        category,
        srid: epsg,
        minZoom: 0,
        maxZoom: 22,
        legendConfig: {},
        metadata: { source: 'admin_geotiff_upload', originalName: file.name },
        isPublic,
      })
      toast.success('Đã tải lên GeoTIFF và công bố lớp bản đồ.')
      reset()
      onPublished()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xử lý GeoTIFF.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Thêm lớp GeoTIFF</DialogTitle>
        <DialogDescription>
          Tệp được tải vào kho raster, sau đó công bố thành lớp WebGIS qua dịch vụ bản đồ.
        </DialogDescription>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="geotiff-file">Tệp GeoTIFF *</Label>
            <Input
              id="geotiff-file"
              type="file"
              accept=".tif,.tiff,image/tiff"
              disabled={saving}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geotiff-title">Tên lớp *</Label>
            <Input
              id="geotiff-title"
              value={title}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="geotiff-code">Mã lớp</Label>
              <Input
                id="geotiff-code"
                value={code}
                disabled={saving}
                onChange={(event) => setCode(toLayerCode(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="geotiff-epsg">EPSG *</Label>
              <Input
                id="geotiff-epsg"
                inputMode="numeric"
                value={srid}
                disabled={saving}
                onChange={(event) => setSrid(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={category} onValueChange={setCategory} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAP_LAYER_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nguồn ảnh</Label>
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
              <Label htmlFor="geotiff-date">Ngày thu nhận *</Label>
              <Input
                id="geotiff-date"
                type="date"
                value={acquiredAt}
                disabled={saving}
                onChange={(event) => setAcquiredAt(event.target.value)}
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={saving}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              Công khai trên WebGIS
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={close}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang xử lý…' : 'Tải lên và công bố'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
