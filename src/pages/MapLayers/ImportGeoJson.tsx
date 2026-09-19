import type { JSX } from 'react'
import { useState, useCallback } from 'react'
import PageLayout from '@/layout/pageLayout'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { mapLayerService, useApiMutation } from '@/service'
import { toast } from 'react-toastify'
import { CheckCircle2, Download, FileJson, Info } from 'lucide-react'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import CategorySelect from '@/components/common/CategorySelect'
import { toCategorySlug } from '@/constant/mapLayerConstant'

function extractGeoJson(raw: any): GeoJSON.GeoJSON | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) return raw as GeoJSON.FeatureCollection
  if (raw.type === 'Feature' && raw.geometry) return raw as GeoJSON.Feature
  if (typeof raw.type === 'string' && raw.coordinates) return raw as GeoJSON.Geometry
  return null
}

function toLayerCode(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 54)

  const code = ascii || `layer_${Date.now()}`
  return /^[a-z_]/.test(code) ? code : `layer_${code}`
}

function downloadGeoJsonSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Mẫu điểm 1', code: 'P001' },
        geometry: { type: 'Point', coordinates: [108, 14.35] },
      },
      {
        type: 'Feature',
        properties: { name: 'Mẫu điểm 2', code: 'P002' },
        geometry: { type: 'Point', coordinates: [108.02, 14.36] },
      },
    ],
  }

  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample-map-layer.geojson'
  link.click()
  URL.revokeObjectURL(url)
}

const MAX_GEOJSON_SIZE = 50 * 1024 * 1024
// Keep closed until a real import endpoint and contract tests are available.
const GEOJSON_IMPORT_AVAILABLE = false

export default function ImportGeoJsonPage(): JSX.Element {
  const user = useAuthStore((state) => state.user)
  const canPublish = hasPerm(user, 'layers', 'update')
  const [category, setCategory] = useState<string>('forest_district')
  const [categoryName, setCategoryName] = useState<string>('Phân loại đối tượng theo huyện')
  const [name, setName] = useState<string>('')
  const [publishAfterImport, setPublishAfterImport] = useState<'true' | 'false'>(
    canPublish ? 'true' : 'false'
  )
  const [geoJsonFiles, setGeoJsonFiles] = useState<File[]>([])
  const [previewGeoJson, setPreviewGeoJson] = useState<GeoJSON.GeoJSON | null>(null)
  const [previewError, setPreviewError] = useState<string>('')

  const file = geoJsonFiles[0] ?? null

  const importMutation = useApiMutation(
    (payload: FormData) => mapLayerService.importGeoJson(payload),
    {
      onSuccess: () => {
        setName('')
        setCategory('forest_district')
        setCategoryName('Phân loại đối tượng theo huyện')
        setPublishAfterImport(canPublish ? 'true' : 'false')
        setGeoJsonFiles([])
        setPreviewGeoJson(null)
        setPreviewError('')
      },
    },
    true
  )

  const onFileValidate = useCallback((f: File): string | null => {
    const isGeoJson = /\.(geojson|json)$/i.test(f.name)
    if (!isGeoJson) return 'Chỉ chấp nhận tệp có phần mở rộng .geojson hoặc .json'
    if (f.size > MAX_GEOJSON_SIZE) return 'Kích thước file không được quá 50MB'
    return null
  }, [])

  const onFileReject = useCallback((_f: File, message: string) => {
    toast.error(message)
  }, [])

  async function handleGeoJsonFilesChange(files: File[]) {
    setGeoJsonFiles(files)
    const selectedFile = files[0] ?? null
    setPreviewGeoJson(null)
    setPreviewError('')
    if (!selectedFile) return

    try {
      const text = await selectedFile.text()
      const parsed = JSON.parse(text)
      const geojson = extractGeoJson(parsed)
      if (!geojson) {
        setPreviewError('Tệp không chứa dữ liệu đường nét hợp lệ để xem trước')
        return
      }
      setPreviewGeoJson(geojson)
    } catch {
      setPreviewError('Không đọc được tệp dữ liệu hoặc nội dung tệp không hợp lệ')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!GEOJSON_IMPORT_AVAILABLE) return

    const trimmedName = name.trim()
    const finalCategory = (category === 'other' || !category)
      ? (toCategorySlug(categoryName) || 'other')
      : category

    if (!finalCategory || (finalCategory === 'other' && !categoryName.trim())) {
      toast.error('Vui lòng chọn hoặc nhập nhóm lớp')
      return
    }
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên lớp')
      return
    }
    if (!file) {
      toast.error('Vui lòng chọn tệp dữ liệu đường nét')
      return
    }

    const geoJsonFile =
      file.type && file.type.trim()
        ? file
        : new File([await file.arrayBuffer()], file.name, {
            type: file.name.toLowerCase().endsWith('.geojson')
              ? 'application/geo+json'
              : 'application/json',
          })

    const code = toLayerCode(trimmedName)
    const fd = new FormData()
    fd.append('file', geoJsonFile)
    fd.append('code', code)
    fd.append('name_vi', trimmedName)
    fd.append('table_name', code)
    fd.append('source_format', 'geojson')
    fd.append('import_mode', 'overwrite')
    fd.append('srid_input', '4326')
    fd.append('category', finalCategory)
    if (categoryName.trim()) {
      fd.append('category_name', categoryName.trim())
    }
    fd.append('layer_kind', 'overlay')
    fd.append('is_public', publishAfterImport)
    fd.append('auto_publish', publishAfterImport)

    importMutation.mutate(fd)
  }

  return (
    <PageLayout
      title="Nhập dữ liệu đường nét"
      description="Nhập dữ liệu đường nét để tạo lớp bản đồ mới"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-4 sm:p-6">
          <div id="geojson-import-unavailable" className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold">Tính năng nhập trực tiếp GeoJSON đang được hoàn thiện</p>
              <p className="mt-1 text-xs opacity-90">
                Hiện tại API backend chưa hỗ trợ nhập trực tiếp GeoJSON. Để nhập dữ liệu lớp bản đồ, vui lòng sử dụng chức năng tải ảnh nguồn GeoTIFF hoặc liên hệ quản trị hệ thống để nhập qua Shapefile / Excel.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <CategorySelect
              category={category}
              categoryName={categoryName}
              onCategoryChange={setCategory}
              onCategoryNameChange={setCategoryName}
              label="Nhóm lớp"
              required
              id="geojson-category"
            />

            <div className="space-y-2">
              <Label htmlFor="layer-name">
                Tên lớp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="layer-name"
                placeholder="Nhập tên lớp bản đồ"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Trạng thái sau khi nhập</Label>
              <Select
                value={publishAfterImport}
                onValueChange={(v) => setPublishAfterImport(v as 'true' | 'false')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canPublish && (
                    <SelectItem value="true">
                      Công khai trên WebGIS sau khi nhập thành công
                    </SelectItem>
                  )}
                  <SelectItem value="false">Chỉ tạo lớp, chưa công bố</SelectItem>
                </SelectContent>
              </Select>
              {!canPublish && (
                <p className="text-muted-foreground text-xs">
                  Tài khoản hiện tại không có quyền công bố lớp lên WebGIS.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Tệp dữ liệu đường nét <span className="text-destructive">*</span>
              </Label>
              <FileUpload
                label="Tệp dữ liệu đường nét *"
                value={geoJsonFiles}
                onValueChange={handleGeoJsonFilesChange}
                onFileValidate={onFileValidate}
                onFileReject={onFileReject}
                accept=".geojson,.json,application/geo+json,application/json"
                maxFiles={1}
                maxSize={MAX_GEOJSON_SIZE}
                disabled={importMutation.isPending}
              >
                <FileUploadDropzone className="border-dashed">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <FileJson className="text-muted-foreground size-6" />
                    <p className="text-sm font-medium">Kéo thả tệp dữ liệu vào đây</p>
                    <p className="text-muted-foreground text-xs">hoặc</p>
                    <FileUploadTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={importMutation.isPending}>
                        Chọn tệp dữ liệu
                      </Button>
                    </FileUploadTrigger>
                    <p className="text-muted-foreground text-xs">Hỗ trợ .geojson, .json · Tối đa 50MB</p>
                  </div>
                </FileUploadDropzone>
                <FileUploadList>
                  {geoJsonFiles.map((f) => (
                    <FileUploadItem key={f.name} value={f}>
                      <FileUploadItemPreview />
                      <FileUploadItemMetadata />
                      <FileUploadItemDelete asChild>
                        <Button type="button" variant="ghost" size="sm" disabled={importMutation.isPending}>
                          Xóa
                        </Button>
                      </FileUploadItemDelete>
                    </FileUploadItem>
                  ))}
                </FileUploadList>
              </FileUpload>
              {previewError && <p className="text-destructive text-xs">{previewError}</p>}
              {previewGeoJson && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">Xem trước dữ liệu trên bản đồ</p>
                  <GeoJsonMapPreview geojson={previewGeoJson} />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName('')
                  setCategory('forest_district')
                  setPublishAfterImport(canPublish ? 'true' : 'false')
                  setGeoJsonFiles([])
                  setPreviewGeoJson(null)
                  setPreviewError('')
                }}
                disabled={importMutation.isPending}
                className="w-full sm:w-auto"
              >
                Làm mới
              </Button>
              <Button id="geojson-import-submit" type="submit" disabled={!GEOJSON_IMPORT_AVAILABLE || importMutation.isPending} aria-describedby="geojson-import-unavailable" className="w-full sm:w-auto">
                Nhập dữ liệu
              </Button>
            </div>
          </form>
        </Card>

        <Card className="from-primary/10 to-background h-fit space-y-4 bg-gradient-to-b p-4 sm:p-5 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 text-primary rounded-md p-2">
              <FileJson size={18} />
            </div>
            <div>
              <p className="font-semibold">Hướng dẫn chuẩn bị tệp</p>
              <p className="text-muted-foreground text-xs">Kiểm tra tệp trước khi nhập</p>
            </div>
          </div>

          <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Info size={16} />
              Định dạng hợp lệ
            </div>
            <p className="text-muted-foreground text-xs">
              Tệp phải chứa dữ liệu hình học và tọa độ hợp lệ.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Kiểm tra nhanh</p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Tệp có phần mở rộng .geojson hoặc .json.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Mỗi đối tượng có hình học và tọa độ hợp lệ.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Tên lớp rõ nghĩa để hệ thống tạo mã lớp ổn định.
            </p>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={downloadGeoJsonSample}>
            <Download size={16} />
            Tải tệp mẫu
          </Button>
        </Card>
      </div>
    </PageLayout>
  )
}
