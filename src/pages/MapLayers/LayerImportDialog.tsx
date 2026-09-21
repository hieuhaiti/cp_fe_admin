import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileArchive,
  Info,
  Layers,
  Loader2,
  Sparkles,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CategorySelect from '@/components/common/CategorySelect'
import { toCategorySlug } from '@/constant/mapLayerConstant'
import { mapLayerService, remoteSensingService, useApiQuery } from '@/service'
import storageService from '@/service/storageService'
import type { ImportJob, ImportJobError, ShapefileImportPayload } from '@/types/api'
import { toast } from 'react-toastify'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB (Khớp STORAGE_MAX_LAYER_MB trên server)
const LAYER_CODE_REGEX = /^[a-z][a-z0-9_]{2,58}$/

export interface LayerImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'geotiff' | 'shapefile'
  defaultGeoTiffMode?: 'standalone' | 'time_series'
  onSuccess?: () => void
  onPublished?: () => void
}

type ImportPhase = 'idle' | 'uploading' | 'enqueueing' | 'processing' | 'saving' | 'completed' | 'failed'

const SRID_OPTIONS = [
  { value: '4326', label: 'EPSG:4326 - WGS 84 (GPS / Chuẩn toàn cầu - Khuyến nghị)' },
  { value: '3405', label: 'EPSG:3405 - VN-2000 / UTM Zone 48N (Quảng Ninh & Miền Bắc)' },
  { value: '3857', label: 'EPSG:3857 - Web Mercator (Google Maps / OSM)' },
  { value: 'custom', label: 'Tùy chỉnh mã EPSG khác...' },
]

const ENCODING_OPTIONS = [
  { value: 'auto', label: 'Tự động (Dựa trên file .cpg hoặc mặc định UTF-8)' },
  { value: 'UTF-8', label: 'UTF-8 (Unicode chuẩn)' },
  { value: 'CP1258', label: 'CP1258 / Windows-1258 (Tiếng Việt chuẩn Windows)' },
  { value: 'TCVN3', label: 'TCVN3 / ABC (Bản đồ font .VnTime cũ)' },
  { value: 'CP1252', label: 'CP1252 / Windows-1252 (Ký tự Tây Âu)' },
]

const PLATFORM_OPTIONS = [
  { value: 'sentinel-2', label: 'Sentinel-2 (MSI)' },
  { value: 'landsat-8', label: 'Landsat-8 (OLI)' },
  { value: 'landsat-9', label: 'Landsat-9 (OLI-2)' },
  { value: 'modis', label: 'MODIS (Terra/Aqua)' },
  { value: 'planetscope', label: 'PlanetScope' },
  { value: 'uav_drone', label: 'Thiết bị bay không người lái (UAV / Drone)' },
  { value: 'aerial_survey', label: 'Ảnh bay chụp chuyên dụng hàng không' },
  { value: 'other', label: 'Nguồn ảnh viễn thám khác' },
]

function generateLayerCode(nameVi: string): string {
  const ascii = nameVi
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 58)

  if (!ascii) return ''
  const valid = /^[a-z]/.test(ascii) ? ascii : `layer_${ascii}`.slice(0, 58)
  return valid.length >= 3 ? valid : `${valid}_gis`.slice(0, 58)
}

function toCoverageKey(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 80)
  return normalized
}

export default function LayerImportDialog({
  open,
  onOpenChange,
  defaultTab = 'geotiff',
  defaultGeoTiffMode = 'standalone',
  onSuccess,
  onPublished,
}: LayerImportDialogProps) {
  // Format Tab: 'geotiff' (mặc định đứng đầu) | 'shapefile' (đứng sau)
  const [activeTab, setActiveTab] = useState<'geotiff' | 'shapefile'>(defaultTab)

  // GeoTIFF mode: 'standalone' (mặc định độc lập) | 'time_series' (geotiff chuỗi lớp)
  const [geoTiffMode, setGeoTiffMode] = useState<'standalone' | 'time_series'>(defaultGeoTiffMode)

  // Common Phase state
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  // ----------------------------------------------------
  // GeoTIFF Form Fields
  // ----------------------------------------------------
  const [tiffFiles, setTiffFiles] = useState<File[]>([])
  const [tiffTitle, setTiffTitle] = useState('')
  const [tiffCode, setTiffCode] = useState('')
  const [isTiffCodeEdited, setIsTiffCodeEdited] = useState(false)
  const [coverageKey, setCoverageKey] = useState('')
  const [tiffCategory, setTiffCategory] = useState('remote_sensing')
  const [tiffCategoryName, setTiffCategoryName] = useState('Ảnh viễn thám')
  const [platform, setPlatform] = useState('sentinel-2')
  const [acquiredAt, setAcquiredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [tiffSrid, setTiffSrid] = useState('4326')
  const [isTiffPublic, setIsTiffPublic] = useState(false)
  const [createdTiffInfo, setCreatedTiffInfo] = useState<{
    code: string
    title: string
    srid: number
    coverageKey?: string
    isStandalone: boolean
  } | null>(null)

  // ----------------------------------------------------
  // Shapefile Form Fields
  // ----------------------------------------------------
  const [zipFiles, setZipFiles] = useState<File[]>([])
  const [shpNameVi, setShpNameVi] = useState('')
  const [shpCode, setShpCode] = useState('')
  const [isShpCodeEdited, setIsShpCodeEdited] = useState(false)
  const [shpCategory, setShpCategory] = useState('ranh_gioi')
  const [shpCategoryName, setShpCategoryName] = useState('Ranh giới hành chính')
  const [selectedShpSridPreset, setSelectedShpSridPreset] = useState('4326')
  const [customShpSrid, setCustomShpSrid] = useState('')
  const [sourceEncoding, setSourceEncoding] = useState('auto')
  const [topologyProfile, setTopologyProfile] = useState<'basic' | 'administrative_boundary'>('basic')
  const [isShpPublic, setIsShpPublic] = useState(true)

  // Polling state for Shapefile
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [jobDetail, setJobDetail] = useState<ImportJob | null>(null)
  const [jobErrors, setJobErrors] = useState<ImportJobError[]>([])
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Query catalog for time-series suggestions
  const timeSeriesCatalogQuery = useApiQuery(
    ['webMap', 'timeSeriesLayers'],
    () => mapLayerService.getTimeSeriesCatalog(),
    { enabled: open && activeTab === 'geotiff' && geoTiffMode === 'time_series', staleTime: 60000 }
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

  // Sync initial tab / mode when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setGeoTiffMode(defaultGeoTiffMode)
    }
  }, [open, defaultTab, defaultGeoTiffMode])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const resetAllForms = useCallback(() => {
    stopPolling()
    setPhase('idle')
    setStatusMessage('')

    // Reset GeoTIFF
    setTiffFiles([])
    setTiffTitle('')
    setTiffCode('')
    setIsTiffCodeEdited(false)
    setCoverageKey('')
    setTiffCategory('remote_sensing')
    setTiffCategoryName('Ảnh viễn thám')
    setPlatform('sentinel-2')
    setAcquiredAt(new Date().toISOString().slice(0, 10))
    setTiffSrid('4326')
    setIsTiffPublic(false)
    setCreatedTiffInfo(null)

    // Reset Shapefile
    setZipFiles([])
    setShpNameVi('')
    setShpCode('')
    setIsShpCodeEdited(false)
    setShpCategory('ranh_gioi')
    setShpCategoryName('Ranh giới hành chính')
    setSelectedShpSridPreset('4326')
    setCustomShpSrid('')
    setSourceEncoding('auto')
    setTopologyProfile('basic')
    setIsShpPublic(true)
    setActiveJobId(null)
    setJobDetail(null)
    setJobErrors([])
  }, [stopPolling])

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'uploading' || phase === 'enqueueing' || phase === 'processing' || phase === 'saving') {
      return
    }
    if (!newOpen) {
      resetAllForms()
    }
    onOpenChange(newOpen)
  }

  // ----------------------------------------------------
  // GeoTIFF Handlers
  // ----------------------------------------------------
  const handleTiffTitleChange = (val: string) => {
    setTiffTitle(val)
    if (!isTiffCodeEdited) {
      setTiffCode(generateLayerCode(val))
    }
    if (!coverageKey && geoTiffMode === 'time_series') {
      setCoverageKey(toCoverageKey(val))
    }
  }

  const handleTiffSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const file = tiffFiles[0]
    if (!file) {
      toast.error('Vui lòng chọn tệp ảnh bản đồ.')
      return
    }
    if (!tiffTitle.trim()) {
      toast.error('Vui lòng nhập tên lớp bản đồ.')
      return
    }

    const finalCategory =
      tiffCategory === 'other' || !tiffCategory
        ? toCategorySlug(tiffCategoryName) || 'other'
        : tiffCategory
    if (!finalCategory || (finalCategory === 'other' && !tiffCategoryName.trim())) {
      toast.error('Vui lòng chọn hoặc nhập tên danh mục hợp lệ.')
      return
    }

    if (geoTiffMode === 'time_series') {
      const activeCoverageKey = toCoverageKey(coverageKey || tiffCode || tiffTitle)
      if (!activeCoverageKey) {
        toast.error('Vui lòng nhập khóa nhóm chuỗi thời gian.')
        return
      }

      setPhase('uploading')
      setStatusMessage('Đang tải tệp ảnh GeoTIFF lên hệ thống lưu trữ MinIO...')

      try {
        const fileObjectId = await storageService.upload(file, 'raster')
        setPhase('saving')
        setStatusMessage('Đang lưu thông tin ảnh vào chuỗi thời gian...')

        const sceneCode = `${activeCoverageKey}_${acquiredAt.replace(/[^0-9]/g, '')}_${Date.now()}`.slice(0, 100)
        const imageResponse = await remoteSensingService.createImage({
          sceneCode,
          title: tiffTitle.trim(),
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
        if (!Number.isInteger(imageId) || imageId <= 0) {
          throw new Error('Hệ thống chưa tạo được hồ sơ ảnh bản đồ.')
        }

        toast.success(`Đã thêm ảnh vào chuỗi thời gian "${activeCoverageKey}".`)
        resetAllForms()
        if (onPublished) onPublished()
        else if (onSuccess) onSuccess()
        onOpenChange(false)
      } catch (error: any) {
        setPhase('failed')
        const message =
          error?.response?.data?.message || error?.message || 'Không thể lưu ảnh vào chuỗi thời gian.'
        setStatusMessage(message)
        toast.error(message)
      }
      return
    }

    // Chế độ độc lập (Standalone)
    const rawLayerCode = tiffCode.trim() || generateLayerCode(tiffTitle)
    const layerCode = generateLayerCode(rawLayerCode) || `raster_${Date.now()}`
    const activeCoverageKey = coverageKey.trim() ? toCoverageKey(coverageKey) : layerCode

    const parsedSrid = Number.parseInt(tiffSrid.trim(), 10)
    if (!Number.isInteger(parsedSrid) || parsedSrid <= 0) {
      toast.error('Hệ tọa độ không hợp lệ.')
      return
    }

    setPhase('uploading')
    setStatusMessage('Đang tải tệp ảnh GeoTIFF lên hệ thống lưu trữ MinIO...')

    try {
      const fileObjectId = await storageService.upload(file, 'raster')
      setPhase('saving')
      setStatusMessage('Đang tạo hồ sơ ảnh và công bố lớp dữ liệu độc lập...')

      const imageResponse = await remoteSensingService.createImage({
        sceneCode: `${layerCode}_${Date.now()}`.slice(0, 100),
        title: tiffTitle.trim(),
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
      if (!Number.isInteger(imageId) || imageId <= 0) {
        throw new Error('Hệ thống chưa tạo được hồ sơ ảnh bản đồ.')
      }

      const publishRes = await remoteSensingService.publishImage(imageId, {
        code: layerCode,
        nameVi: tiffTitle.trim(),
        category: finalCategory,
        srid: parsedSrid,
        minZoom: 0,
        maxZoom: 22,
        legendConfig: {},
        metadata: { source: 'admin_geotiff_upload', originalName: file.name },
        isPublic: isTiffPublic,
      })

      const publishedLayer = (publishRes.data as { layer?: { id?: number; updatedAt?: string; updated_at?: string } })?.layer
      const publishedLayerId = publishedLayer?.id
      if (publishedLayerId && tiffCategoryName.trim()) {
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
              categoryName: tiffCategoryName.trim(),
            })
          }
        } catch (patchErr) {
          console.warn('Không thể cập nhật tên danh mục tiếng Việt:', patchErr)
        }
      }

      toast.success('Đã tải lên tệp ảnh và công bố lớp bản đồ.')
      resetAllForms()
      if (onPublished) onPublished()
      else if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      setPhase('failed')
      const errErrors = error?.response?.data?.errors as string[] | undefined
      const errCode = errErrors?.[0]
      const errMsg = error?.response?.data?.message
      if (errErrors?.includes('LAYER_CODE_RETIRED')) {
        const msg = `Mã lớp "${layerCode}" đã từng được sử dụng trong lịch sử hệ thống và đã bị hủy. Vui lòng đổi sang một mã lớp mới (ví dụ: ${layerCode}_1).`
        setStatusMessage(msg)
        toast.error(msg)
      } else if (errCode === 'RASTER_LAYER_CONFLICT' || errCode === 'LAYER_CODE_IN_USE_BY_OTHER_IMAGE') {
        const msg = `Mã lớp độc lập "${layerCode}" đã tồn tại. Nếu bạn muốn gom nhiều mốc thời gian, hãy chọn mục "Thêm vào chuỗi thời gian" với cùng nhóm chuỗi thời gian.`
        setStatusMessage(msg)
        toast.error(msg)
      } else {
        const msg = errMsg || error?.message || 'Không thể xử lý tệp ảnh.'
        setStatusMessage(msg)
        toast.error(msg)
      }
    }
  }

  // ----------------------------------------------------
  // Shapefile Handlers
  // ----------------------------------------------------
  const pollJobOnce = useCallback(
    async (jobId: number): Promise<boolean> => {
      try {
        const res = await mapLayerService.getImportJob(jobId)
        const job = res.data
        if (!job) return false

        setJobDetail(job)

        if (job.status === 'succeeded' || job.status === 'completed') {
          stopPolling()
          setPhase('completed')
          setStatusMessage('Nhập dữ liệu và khởi tạo lớp bản đồ thành công!')
          toast.success(`Nhập thành công lớp "${shpNameVi || job.layer_code}"!`)
          onSuccess?.()
          onPublished?.()
          return true
        } else if (job.status === 'failed') {
          stopPolling()
          setPhase('failed')
          const errText = job.error_message || 'Có lỗi xảy ra trong quá trình xử lý không gian.'
          setStatusMessage(errText)
          toast.error(`Nhập dữ liệu thất bại: ${errText}`)

          try {
            const errRes = await mapLayerService.getImportErrors(jobId, { page: 1, limit: 20 })
            const errorItems = (errRes as any)?.data?.items || errRes.data || []
            if (Array.isArray(errorItems)) {
              setJobErrors(errorItems)
            }
          } catch {
            // Ignore error query failure
          }
          return true
        } else {
          const progress = job.progress ?? 0
          setStatusMessage(
            progress > 0
              ? `Đang xử lý dữ liệu không gian (${progress}%)...`
              : 'Đang xếp hàng chờ xử lý dữ liệu...'
          )
          return false
        }
      } catch {
        return false
      }
    },
    [shpNameVi, onSuccess, onPublished, stopPolling]
  )

  const startShpPolling = useCallback(
    (jobId: number) => {
      stopPolling()
      setActiveJobId(jobId)
      setPhase('processing')
      setStatusMessage('Máy chủ đang nạp dữ liệu không gian vào PostGIS...')

      void pollJobOnce(jobId).then((finished) => {
        if (finished) return

        let attempts = 0
        const maxPollAttempts = 120 // ~3 phút

        pollTimerRef.current = setInterval(async () => {
          attempts++
          if (attempts >= maxPollAttempts) {
            stopPolling()
            setPhase('failed')
            setStatusMessage('Quá thời gian chờ kiểm tra tiến trình.')
            return
          }
          const done = await pollJobOnce(jobId)
          if (done) {
            stopPolling()
          }
        }, 1500)
      })
    },
    [pollJobOnce, stopPolling]
  )

  const handleShpSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const file = zipFiles[0]
    if (!file) {
      toast.error('Vui lòng chọn tệp nén .zip chứa Shapefile.')
      return
    }
    if (!shpNameVi.trim() || shpNameVi.trim().length < 2) {
      toast.error('Tên lớp bản đồ phải có ít nhất 2 ký tự.')
      return
    }

    const trimmedCode = shpCode.trim().toLowerCase()
    if (!trimmedCode) {
      toast.error('Vui lòng nhập hoặc tạo mã lớp bản đồ.')
      return
    }
    if (!LAYER_CODE_REGEX.test(trimmedCode)) {
      toast.error(
        'Mã lớp không hợp lệ. Phải từ 3 đến 59 ký tự, bắt đầu bằng chữ thường (a-z) và chỉ chứa chữ thường, số và dấu gạch dưới.'
      )
      return
    }

    const finalCategory =
      shpCategory === 'other' || !shpCategory
        ? toCategorySlug(shpCategoryName) || 'other'
        : shpCategory
    if (!finalCategory || (finalCategory === 'other' && !shpCategoryName.trim())) {
      toast.error('Vui lòng chọn hoặc nhập nhóm danh mục hợp lệ.')
      return
    }

    let targetSrid = 4326
    if (selectedShpSridPreset === 'custom') {
      const parsedSrid = parseInt(customShpSrid.trim(), 10)
      if (!parsedSrid || parsedSrid <= 0) {
        toast.error('Vui lòng nhập mã EPSG hệ tọa độ hợp lệ (số nguyên dương).')
        return
      }
      targetSrid = parsedSrid
    } else {
      targetSrid = parseInt(selectedShpSridPreset, 10) || 4326
    }

    setPhase('uploading')
    setStatusMessage('Đang tải tệp Shapefile (.zip) lên hệ thống lưu trữ MinIO...')

    let fileObjectId: number | string
    try {
      fileObjectId = await storageService.upload(file, 'layers')
    } catch (uploadErr: any) {
      setPhase('failed')
      const msg = uploadErr?.message || 'Tải tệp lên hệ thống lưu trữ thất bại.'
      setStatusMessage(msg)
      toast.error(msg)
      return
    }

    setPhase('enqueueing')
    setStatusMessage('Đang xếp hàng tác vụ nhập dữ liệu trên máy chủ...')

    const payload: ShapefileImportPayload = {
      fileObjectId: Number(fileObjectId),
      code: trimmedCode,
      nameVi: shpNameVi.trim(),
      category: finalCategory,
      targetSrid,
      isPublic: isShpPublic,
      topologyProfile,
      ...(sourceEncoding && sourceEncoding !== 'auto' ? { sourceEncoding } : {}),
    }

    try {
      const jobRes = await mapLayerService.importShapefile(payload)
      const createdJob = (jobRes as any)?.data || jobRes
      const jobId = createdJob?.id || createdJob?.jobId

      if (!jobId) {
        throw new Error('Máy chủ không trả về mã tác vụ import.')
      }

      startShpPolling(Number(jobId))
    } catch (jobErr: any) {
      setPhase('failed')
      const msg =
        jobErr?.response?.data?.message ||
        jobErr?.message ||
        'Không thể khởi tạo tác vụ nhập Shapefile.'
      setStatusMessage(msg)
      toast.error(msg)
    }
  }

  const isBusy =
    phase === 'uploading' ||
    phase === 'enqueueing' ||
    phase === 'processing' ||
    phase === 'saving'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-primary">
            {activeTab === 'geotiff' ? (
              <Layers className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileArchive className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            )}
            <DialogTitle className="text-xl">
              {activeTab === 'shapefile' ? 'Nhập lớp bản đồ từ Shapefile' : 'Thêm ảnh bản đồ GeoTIFF'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {activeTab === 'shapefile'
              ? 'Tải lên tệp nén .zip chứa bộ dữ liệu Shapefile để chuyển đổi tự động vào PostGIS và công bố lớp dữ liệu lên hệ thống WebGIS.'
              : 'Tải lên tệp ảnh viễn thám GeoTIFF (.tif, .tiff) để công bố thành lớp bản đồ độc lập hoặc thêm vào chuỗi thời gian WebGIS.'}
          </DialogDescription>
        </DialogHeader>

        {/* Phase: completed / failed / progress view */}
        {phase !== 'idle' && (
          <div className="my-2 rounded-xl border border-border/80 bg-muted/40 p-4 transition-all">
            <div className="flex items-center gap-3">
              {isBusy && <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />}
              {phase === 'completed' && (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
              )}
              {phase === 'failed' && <XCircle className="h-6 w-6 shrink-0 text-destructive" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {phase === 'uploading' && 'Bước 1/3: Tải tệp lên máy chủ lưu trữ'}
                    {phase === 'enqueueing' && 'Bước 2/3: Xếp hàng xử lý'}
                    {phase === 'saving' && 'Bước 2/2: Khởi tạo và công bố lớp bản đồ'}
                    {phase === 'processing' && 'Bước 3/3: Chuyển đổi và nạp dữ liệu PostGIS'}
                    {phase === 'completed' &&
                      (activeTab === 'shapefile'
                        ? 'Nhập Shapefile thành công!'
                        : 'Công bố ảnh GeoTIFF thành công!')}
                    {phase === 'failed' &&
                      (activeTab === 'shapefile'
                        ? 'Nhập Shapefile thất bại'
                        : 'Xử lý ảnh GeoTIFF thất bại')}
                  </p>
                  <div className="flex items-center gap-2">
                    {activeJobId && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        #{activeJobId}
                      </span>
                    )}
                    {jobDetail?.progress !== undefined && isBusy && (
                      <span className="text-xs font-mono font-medium text-muted-foreground">
                        {jobDetail.progress}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{statusMessage}</p>
              </div>
            </div>

            {/* Thanh tiến trình */}
            {isBusy && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width:
                      phase === 'uploading'
                        ? '35%'
                        : phase === 'enqueueing' || phase === 'saving'
                          ? '65%'
                          : `${Math.max(65, jobDetail?.progress ?? 65)}%`,
                  }}
                />
              </div>
            )}

            {/* Chi tiết kết quả khi thành công - Shapefile */}
            {phase === 'completed' && activeTab === 'shapefile' && jobDetail && (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block">Mã lớp:</span>
                  <span className="font-semibold text-foreground">{shpCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Số đối tượng:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {jobDetail.feature_count?.toLocaleString() ?? 'Đã nạp'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hình học:</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {jobDetail.geometry_type || 'VECTOR'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hệ toạ độ:</span>
                  <span className="font-semibold text-foreground">
                    EPSG:{jobDetail.target_srid || 4326}
                  </span>
                </div>
              </div>
            )}

            {/* Chi tiết kết quả khi thành công - GeoTIFF */}
            {phase === 'completed' && activeTab === 'geotiff' && createdTiffInfo && (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block">Mã lớp:</span>
                  <span className="font-semibold text-foreground">{createdTiffInfo.code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Chế độ:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {createdTiffInfo.isStandalone ? 'Lớp độc lập' : 'Chuỗi thời gian'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Định dạng:</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    GeoTIFF
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hệ toạ độ:</span>
                  <span className="font-semibold text-foreground">
                    EPSG:{createdTiffInfo.srid}
                  </span>
                </div>
              </div>
            )}

            {/* Danh sách lỗi nếu có (Shapefile) */}
            {phase === 'failed' && jobErrors.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Danh sách đối tượng bị lỗi ({jobErrors.length}):
                </p>
                <ScrollArea className="h-32 rounded border border-destructive/20 bg-destructive/5 p-2 text-xs">
                  <ul className="space-y-1">
                    {jobErrors.map((err, idx) => (
                      <li key={err.id || idx} className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {err.source_row ? `Dòng ${err.source_row}: ` : `Lỗi ${idx + 1}: `}
                        </span>
                        <span>{err.error_message || err.error_code}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {/* Các nút hành động khi kết thúc */}
            {(phase === 'completed' || phase === 'failed') && (
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetAllForms}
                >
                  {phase === 'completed' ? 'Thêm lớp khác' : 'Thử lại'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Đóng
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Form nhập dữ liệu - chỉ hiển thị khi ở phase idle */}
        {phase === 'idle' && (
          <div className="space-y-4">
            {/* Format Selector: GeoTIFF (Mặc định 1) vs Shapefile (2) */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as 'geotiff' | 'shapefile')}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full p-1 bg-muted/80 rounded-xl mb-3">
                <TabsTrigger
                  value="geotiff"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Layers className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Ảnh bản đồ GeoTIFF</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] ml-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200"
                  >
                    Raster
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="shapefile"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <FileArchive className="size-4 text-sky-600 dark:text-sky-400" />
                  <span>Tệp Shapefile (.zip)</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] ml-1 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200"
                  >
                    Vector
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* TAB 1: GEOTIFF CONTENT */}
            {activeTab === 'geotiff' && (
              <form onSubmit={handleTiffSubmit} className="space-y-4">
                {/* Chế độ GeoTIFF: Độc lập (Mặc định) vs Chuỗi thời gian */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Chế độ tải ảnh viễn thám
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      role="button"
                      onClick={() => setGeoTiffMode('standalone')}
                      className={`text-left cursor-pointer rounded-xl border p-3 transition-all ${
                        geoTiffMode === 'standalone'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500/20'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                          <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Công bố lớp độc lập
                        </span>
                        {geoTiffMode === 'standalone' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        Tải lên và công bố ngay thành một lớp bản đồ độc lập trên WebGIS.
                      </p>
                    </button>

                    <button
                      type="button"
                      role="button"
                      onClick={() => setGeoTiffMode('time_series')}
                      className={`text-left cursor-pointer rounded-xl border p-3 transition-all ${
                        geoTiffMode === 'time_series'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500/20'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                          <Clock className="h-4 w-4 text-primary" />
                          Lớp theo chuỗi thời gian
                        </span>
                        {geoTiffMode === 'time_series' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        Thêm ảnh vào chuỗi thời gian để theo dõi biến động theo từng mốc.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Box hướng dẫn quy cách tệp GeoTIFF */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="text-xs leading-relaxed space-y-1">
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        Yêu cầu tệp ảnh viễn thám GeoTIFF (.tif, .tiff):
                      </p>
                      <p>
                        Hỗ trợ định dạng ảnh raster viễn thám (Sentinel, Landsat, Drone UAV, bản đồ hiện trạng/ngập lụt) có gán tọa độ địa lý.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        * Tệp ảnh gốc được lưu trữ bảo toàn tại Kho ảnh nguồn. Dung lượng tối đa hỗ trợ: <strong>500MB</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chọn tệp GeoTIFF */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Tệp ảnh bản đồ GeoTIFF <span className="text-destructive">*</span>
                  </Label>
                  <FileUpload
                    label="Tệp ảnh bản đồ *"
                    value={tiffFiles}
                    onValueChange={(files) => {
                      setTiffFiles(files)
                      if (files[0] && !tiffTitle) {
                        const baseName = files[0].name.replace(/\.(tif|tiff)$/i, '')
                        setTiffTitle(baseName)
                        setTiffCode(generateLayerCode(baseName))
                        if (geoTiffMode === 'time_series' && !coverageKey) {
                          setCoverageKey(toCoverageKey(baseName))
                        }
                      }
                    }}
                    onFileValidate={(f) => {
                      if (!/\.(tif|tiff)$/i.test(f.name)) return 'Chỉ hỗ trợ tệp .tif hoặc .tiff.'
                      if (f.size > MAX_FILE_SIZE) return 'Kích thước file không được quá 500MB'
                      return null
                    }}
                    onFileReject={(_f, msg) => toast.error(msg)}
                    accept=".tif,.tiff,image/tiff"
                    maxFiles={1}
                    maxSize={MAX_FILE_SIZE}
                  >
                    <FileUploadDropzone className="border-dashed p-4 sm:p-6 transition-all hover:bg-muted/40">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud className="text-muted-foreground size-8 animate-pulse text-emerald-600" />
                        <p className="text-sm font-medium">Kéo thả tệp GeoTIFF (.tif, .tiff) vào đây</p>
                        <p className="text-muted-foreground text-xs">hoặc</p>
                        <FileUploadTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            Chọn tệp GeoTIFF từ máy tính
                          </Button>
                        </FileUploadTrigger>
                        <p className="text-muted-foreground text-[11px] mt-1">
                          Hỗ trợ .tif, .tiff · Tối đa 500MB
                        </p>
                      </div>
                    </FileUploadDropzone>
                    <FileUploadList>
                      {tiffFiles.map((f) => (
                        <FileUploadItem key={f.name} value={f}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete />
                        </FileUploadItem>
                      ))}
                    </FileUploadList>
                  </FileUpload>
                </div>

                {/* Form fields: Tiêu đề & Mã lớp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="geotiff-name" className="text-xs font-semibold">
                      Tên lớp <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="geotiff-name"
                      placeholder="VD: Bản đồ viễn thám Cẩm Phả 2026"
                      value={tiffTitle}
                      onChange={(e) => handleTiffTitleChange(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="geotiff-code" className="text-xs font-semibold">
                        {geoTiffMode === 'standalone' ? 'Mã lớp độc lập' : 'Mã nhận diện'}{' '}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-primary gap-1"
                        onClick={() => {
                          const newCode = generateLayerCode(tiffTitle)
                          setTiffCode(newCode)
                          setIsTiffCodeEdited(true)
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        Tạo tự động
                      </Button>
                    </div>
                    <Input
                      id="geotiff-code"
                      placeholder="VD: campha_sentinel_2026"
                      value={tiffCode}
                      onChange={(e) => {
                        setTiffCode(e.target.value)
                        setIsTiffCodeEdited(true)
                      }}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Nhóm chuỗi thời gian (Coverage Key) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="geotiff-coverage-key" className="text-xs font-semibold">
                      Nhóm chuỗi thời gian{' '}
                      {geoTiffMode === 'time_series' ? (
                        <span className="text-destructive">*</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(Tùy chọn)</span>
                      )}
                    </Label>
                    {existingCoverageOptions.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {existingCoverageOptions.length} nhóm có sẵn
                      </span>
                    )}
                  </div>
                  <Input
                    id="geotiff-coverage-key"
                    placeholder="VD: cam-pha-lop-phu-do-thi"
                    value={coverageKey}
                    onChange={(e) => setCoverageKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                  {existingCoverageOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {existingCoverageOptions.slice(0, 4).map((opt) => (
                        <button
                          key={opt.coverageKey}
                          type="button"
                          onClick={() => {
                            setCoverageKey(opt.coverageKey)
                            if (opt.category) setTiffCategory(opt.category)
                            if (opt.categoryName) setTiffCategoryName(opt.categoryName)
                          }}
                          className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground font-mono transition-colors"
                        >
                          {opt.coverageKey}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Danh mục & Nền tảng viễn thám */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Nhóm danh mục <span className="text-destructive">*</span>
                    </Label>
                    <CategorySelect
                      category={tiffCategory}
                      categoryName={tiffCategoryName}
                      onCategoryChange={setTiffCategory}
                      onCategoryNameChange={setTiffCategoryName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nền tảng ảnh viễn thám</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Hệ tọa độ SRID & Ngày chụp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="geotiff-epsg" className="text-xs font-semibold">
                      Hệ tọa độ <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="geotiff-epsg"
                      inputMode="numeric"
                      placeholder="4326"
                      value={tiffSrid}
                      onChange={(e) => setTiffSrid(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        { label: 'EPSG:4326 (WGS 84)', val: '4326' },
                        { label: 'EPSG:3405 (VN-2000)', val: '3405' },
                        { label: 'EPSG:3857 (Web Mercator)', val: '3857' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setTiffSrid(preset.val)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono border transition-colors ${
                            tiffSrid === preset.val
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
                              : 'border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tiff-acquired" className="text-xs font-semibold">
                      Thời điểm quan sát / Chụp ảnh
                    </Label>
                    <Input
                      id="tiff-acquired"
                      type="date"
                      value={acquiredAt}
                      onChange={(e) => setAcquiredAt(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Phạm vi công khai */}
                <div className="rounded-lg border border-border/80 p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold block">Phạm vi công bố lớp</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isTiffPublic
                          ? 'Công khai: Lớp bản đồ sẽ hiển thị với người dân trên Cổng WebGIS.'
                          : 'Nội bộ: Chỉ cán bộ quản trị và cơ quan ban ngành có quyền mới được xem.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={!isTiffPublic ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsTiffPublic(false)}
                      >
                        Nội bộ
                      </Button>
                      <Button
                        type="button"
                        variant={isTiffPublic ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsTiffPublic(true)}
                      >
                        Công khai
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Hủy
                  </Button>
                  <Button type="submit" disabled={isBusy}>
                    {geoTiffMode === 'standalone' ? 'Tải lên và công bố' : 'Lưu vào chuỗi thời gian'}
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* TAB 2: SHAPEFILE CONTENT */}
            {activeTab === 'shapefile' && (
              <form onSubmit={handleShpSubmit} className="space-y-4">
                {/* Box hướng dẫn quy cách file Shapefile */}
                <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3.5 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <div className="text-xs leading-relaxed space-y-1">
                      <p className="font-semibold text-sky-900 dark:text-sky-100">
                        Yêu cầu cấu trúc tệp Shapefile (.zip):
                      </p>
                      <p>
                        Tệp nén <strong>.zip</strong> cần chứa đầy đủ bộ 4 tệp cùng tên:{' '}
                        <code className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                          .shp
                        </code>{' '}
                        (hình học),{' '}
                        <code className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                          .shx
                        </code>{' '}
                        (chỉ mục),{' '}
                        <code className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                          .dbf
                        </code>{' '}
                        (thuộc tính),{' '}
                        <code className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                          .prj
                        </code>{' '}
                        (hệ tọa độ).
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        * Tùy chọn có thêm tệp <code>.cpg</code> để tự động nhận dạng bảng mã ký tự tiếng Việt.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chọn tệp ZIP */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Tệp nén Shapefile (.zip) <span className="text-destructive">*</span>
                  </Label>
                  <FileUpload
                    label="Tệp Shapefile *"
                    value={zipFiles}
                    onValueChange={(files) => {
                      setZipFiles(files)
                      if (files[0] && !shpNameVi) {
                        const baseName = files[0].name.replace(/\.zip$/i, '')
                        setShpNameVi(baseName)
                        setShpCode(generateLayerCode(baseName))
                      }
                    }}
                    onFileValidate={(f) => {
                      if (!/\.zip$/i.test(f.name)) return 'Chỉ hỗ trợ tệp nén .zip.'
                      if (f.size > MAX_FILE_SIZE) return 'Kích thước file không được quá 500MB'
                      return null
                    }}
                    onFileReject={(_f, msg) => toast.error(msg)}
                    accept=".zip,application/zip,application/x-zip-compressed"
                    maxFiles={1}
                    maxSize={MAX_FILE_SIZE}
                  >
                    <FileUploadDropzone className="border-dashed p-4 sm:p-6 transition-all hover:bg-muted/40">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud className="text-muted-foreground size-8 animate-pulse text-sky-600" />
                        <p className="text-sm font-medium">Kéo thả tệp .zip Shapefile vào đây</p>
                        <p className="text-muted-foreground text-xs">hoặc</p>
                        <FileUploadTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            Chọn tệp .zip từ máy tính
                          </Button>
                        </FileUploadTrigger>
                        <p className="text-muted-foreground text-[11px] mt-1">
                          Hỗ trợ định dạng .zip · Tối đa 500MB
                        </p>
                      </div>
                    </FileUploadDropzone>
                    <FileUploadList>
                      {zipFiles.map((f) => (
                        <FileUploadItem key={f.name} value={f}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete />
                        </FileUploadItem>
                      ))}
                    </FileUploadList>
                  </FileUpload>
                </div>

                {/* Tên & Mã lớp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="shp-name" className="text-xs font-semibold">
                      Tên lớp hiển thị <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="shp-name"
                      placeholder="VD: Ranh giới phường Cẩm Bình"
                      value={shpNameVi}
                      onChange={(e) => {
                        const val = e.target.value
                        setShpNameVi(val)
                        if (!isShpCodeEdited) {
                          setShpCode(generateLayerCode(val))
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="shp-code" className="text-xs font-semibold">
                        Mã lớp kỹ thuật <span className="text-destructive">*</span>
                      </Label>
                      {shpNameVi && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-primary gap-1"
                          onClick={() => {
                            const newCode = generateLayerCode(shpNameVi)
                            setShpCode(newCode)
                            setIsShpCodeEdited(true)
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Tạo tự động
                        </Button>
                      )}
                    </div>
                    <Input
                      id="shp-code"
                      placeholder="VD: ranh_gioi_cam_binh"
                      value={shpCode}
                      onChange={(e) => {
                        setShpCode(e.target.value.toLowerCase())
                        setIsShpCodeEdited(true)
                      }}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Danh mục */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Nhóm danh mục <span className="text-destructive">*</span>
                  </Label>
                  <CategorySelect
                    category={shpCategory}
                    categoryName={shpCategoryName}
                    onCategoryChange={setShpCategory}
                    onCategoryNameChange={setShpCategoryName}
                  />
                </div>

                {/* Hệ tọa độ & Bảng mã ký tự */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="shp-srid" className="text-xs font-semibold">
                      Hệ tọa độ đích (PostGIS)
                    </Label>
                    <Select value={selectedShpSridPreset} onValueChange={setSelectedShpSridPreset}>
                      <SelectTrigger id="shp-srid" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SRID_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedShpSridPreset === 'custom' && (
                      <Input
                        type="number"
                        placeholder="Nhập mã EPSG (VD: 3405)"
                        value={customShpSrid}
                        onChange={(e) => setCustomShpSrid(e.target.value)}
                        className="mt-1 font-mono text-xs"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shp-encoding" className="text-xs font-semibold">
                      Bảng mã ký tự thuộc tính (DBF)
                    </Label>
                    <Select value={sourceEncoding} onValueChange={setSourceEncoding}>
                      <SelectTrigger id="shp-encoding" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENCODING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cấu hình kiểm tra Topology */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cấu hình kiểm tra Topology
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      role="button"
                      onClick={() => setTopologyProfile('basic')}
                      className={`text-left cursor-pointer rounded-xl border p-3 transition-all ${
                        topologyProfile === 'basic'
                          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-xs ring-1 ring-sky-500/20'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">
                          Tự động sửa lỗi (nếu có)
                        </span>
                        {topologyProfile === 'basic' && (
                          <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        Tự động làm sạch hình học (ST_MakeValid, khử điểm trùng). Phù hợp đa số lớp dữ liệu.
                      </p>
                    </button>

                    <button
                      type="button"
                      role="button"
                      onClick={() => setTopologyProfile('administrative_boundary')}
                      className={`text-left cursor-pointer rounded-xl border p-3 transition-all ${
                        topologyProfile === 'administrative_boundary'
                          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-xs ring-1 ring-sky-500/20'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">
                          Không sửa lỗi, hoàn trả file nếu có lỗi
                        </span>
                        {topologyProfile === 'administrative_boundary' && (
                          <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        Chặn triệt để và báo lỗi nếu có tự cắt, hở ranh hoặc đè lấn. Khuyến nghị cho ranh giới hành chính.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Phạm vi công khai */}
                <div className="rounded-lg border border-border/80 p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold block">Phạm vi công bố lớp</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isShpPublic
                          ? 'Công khai: Lớp bản đồ sẽ hiển thị với người dân trên Cổng WebGIS.'
                          : 'Nội bộ: Chỉ cán bộ quản trị và cơ quan ban ngành có quyền mới được xem.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={!isShpPublic ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsShpPublic(false)}
                      >
                        Nội bộ
                      </Button>
                      <Button
                        type="button"
                        variant={isShpPublic ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsShpPublic(true)}
                      >
                        Công khai
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Hủy
                  </Button>
                  <Button type="submit" disabled={zipFiles.length === 0}>
                    Tiến hành nhập Shapefile
                  </Button>
                </DialogFooter>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
