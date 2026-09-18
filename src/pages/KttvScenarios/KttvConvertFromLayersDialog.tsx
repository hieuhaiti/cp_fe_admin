import { useState, useMemo, useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Layers, Loader2, RefreshCw, Search } from 'lucide-react'
import { toast } from 'react-toastify'
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
import { Checkbox } from '@/components/ui/checkbox'
import { kttvScenarioService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer, MapLayerListData } from '@/types/api'
import type { ConvertLayersToScenariosBody, ConvertLayersToScenariosResult } from '@/service/kttvScenarioService'
import { useDebounce } from '@/hooks/useDebounce'
import {
  SCENARIO_TYPE_LIST,
  RCP_OPTION_LIST,
  type ScenarioTypeId,
  type RcpOptionId,
  type RcpOption,
} from './constants'

const optionalNum = z
  .string()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || !isNaN(Number(v)), { message: 'Phải là số hợp lệ' })

const convertSchema = z.object({
  type: z.enum(['hien_trang', 'cai_tao', 'quy_hoach'] as const),
  rcp: z.enum(['rcp45', 'rcp85'] as const).optional().nullable(),
  minRainfall: optionalNum,
  maxRainfall: optionalNum,
  minTide: optionalNum,
  maxTide: optionalNum,
  isActive: z.boolean(),
})

type ConvertFormValues = z.output<typeof convertSchema>

interface KttvConvertFromLayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: ScenarioTypeId
  onConverted?: () => void
}

export default function KttvConvertFromLayersDialog({
  open,
  onOpenChange,
  defaultType = 'hien_trang',
  onConverted,
}: KttvConvertFromLayersDialogProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const [scenarioType, setScenarioType] = useState<ScenarioTypeId>(defaultType)
  const [rcpOption, setRcpOption] = useState<RcpOptionId>('rcp45')

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScenarioType(defaultType)
      setRcpOption('rcp45')
    }
  }, [open, defaultType])

  const layersQuery = useApiQuery(
    ['map-layers-for-scenario-conversion', debouncedSearch],
    () =>
      mapLayerService.getAll({
        page: 1,
        limit: 50,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        q: debouncedSearch || undefined,
      }),
    { enabled: open, staleTime: 60 * 1000 },
    false,
    false
  )

  const availableLayers: MapLayer[] = useMemo(() => {
    const raw = (layersQuery.data as ApiResponse<MapLayerListData> | undefined)?.data
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    return raw?.items ?? raw?.mapLayers ?? []
  }, [layersQuery.data])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof convertSchema>, unknown, ConvertFormValues>({
    resolver: zodResolver(convertSchema),
    defaultValues: {
      type: 'hien_trang',
      rcp: null,
      minRainfall: '',
      maxRainfall: '',
      minTide: '',
      maxTide: '',
      isActive: true,
    },
  })

  const convertMutation = useApiMutation(
    (payload: ConvertLayersToScenariosBody) => kttvScenarioService.convertFromLayers(payload),
    {
      onSuccess: (res: ApiResponse<ConvertLayersToScenariosResult>) => {
        const createdCount = res.data?.created?.length ?? 0
        const skippedCount = res.data?.skipped?.length ?? 0
        toast.success(
          `Đã chuyển đổi thành công ${createdCount} kịch bản ngập${
            skippedCount > 0 ? ` (bỏ qua ${skippedCount} kịch bản đã tồn tại)` : ''
          }`
        )
        onConverted?.()
        onOpenChange(false)
        setSelectedCodes([])
        reset()
      },
    },
    true
  )

  const toggleLayerCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const toggleAll = () => {
    if (selectedCodes.length === availableLayers.length) {
      setSelectedCodes([])
    } else {
      setSelectedCodes(availableLayers.map((l) => l.code))
    }
  }

  const toNum = (v: string | null | undefined) =>
    v === null || v === undefined || v === '' ? null : Number(v)

  const handleFormSubmit: SubmitHandler<ConvertFormValues> = (values) => {
    if (selectedCodes.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một lớp bản đồ để chuyển đổi')
      return
    }

    const payload: ConvertLayersToScenariosBody = {
      layerCodes: selectedCodes,
      type: scenarioType,
      rcp: scenarioType === 'quy_hoach' ? rcpOption : null,
      minRainfall: toNum(values.minRainfall) ?? 0,
      maxRainfall: toNum(values.maxRainfall),
      minTide: toNum(values.minTide),
      maxTide: toNum(values.maxTide),
      isActive: values.isActive,
    }

    convertMutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <RefreshCw className="text-primary h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Chuyển lớp bản đồ thành kịch bản ngập</DialogTitle>
              <DialogDescription>
                Tạo tự động các bản ghi kịch bản ngập từ các lớp bản đồ ngập lụt hiện có trong hệ thống
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Cấu hình phân loại */}
          <div
            className={`grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-3 ${
              scenarioType === 'quy_hoach' ? 'sm:grid-cols-2' : ''
            }`}
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phân loại kịch bản gán cho các lớp</Label>
              <Select
                value={scenarioType}
                onValueChange={(val) => setScenarioType(val as ScenarioTypeId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_TYPE_LIST.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scenarioType === 'quy_hoach' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kịch bản phát thải (RCP)</Label>
                <Select
                  value={rcpOption}
                  onValueChange={(val) => setRcpOption(val as RcpOptionId)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RCP_OPTION_LIST.map((r: RcpOption) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label} ({r.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Ngưỡng mưa và triều */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="conv_min_rainfall" className="text-xs">
                Lượng mưa tối thiểu (mm)
              </Label>
              <Input
                id="conv_min_rainfall"
                {...register('minRainfall')}
                placeholder="0"
                inputMode="decimal"
              />
              {errors.minRainfall && (
                <p className="text-destructive text-xs">{errors.minRainfall.message as string}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv_max_rainfall" className="text-xs">
                Lượng mưa tối đa (mm)
              </Label>
              <Input
                id="conv_max_rainfall"
                {...register('maxRainfall')}
                placeholder="Để trống = không giới hạn"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv_min_tide" className="text-xs">
                Triều tối thiểu (m)
              </Label>
              <Input
                id="conv_min_tide"
                {...register('minTide')}
                placeholder="Tùy chọn"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv_max_tide" className="text-xs">
                Triều tối đa (m)
              </Label>
              <Input
                id="conv_max_tide"
                {...register('maxTide')}
                placeholder="Tùy chọn"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Danh sách lớp bản đồ để chọn */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Chọn lớp bản đồ nguồn ({selectedCodes.length}/{availableLayers.length} đã chọn)
              </Label>
              {availableLayers.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-primary hover:underline text-xs font-medium"
                >
                  {selectedCodes.length === availableLayers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm lớp bản đồ theo tên hoặc mã..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-md border p-2 space-y-1.5 bg-background">
              {layersQuery.isLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải danh sách lớp...
                </div>
              ) : availableLayers.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Không tìm thấy lớp bản đồ phù hợp
                </div>
              ) : (
                availableLayers.map((layer) => {
                  const isChecked = selectedCodes.includes(layer.code)
                  return (
                    <div
                      key={layer.code}
                      onClick={() => toggleLayerCode(layer.code)}
                      className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-primary/10 text-foreground font-medium' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleLayerCode(layer.code)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                        [{layer.code}]
                      </span>
                      <span className="truncate flex-1">{layer.name_vi ?? layer.code}</span>
                      <span className="text-[10px] text-muted-foreground border rounded px-1 shrink-0">
                        {layer.category_name ?? layer.category}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={convertMutation.isPending || selectedCodes.length === 0}
              className="flex items-center gap-1.5"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang chuyển đổi...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Chuyển đổi {selectedCodes.length} lớp
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
