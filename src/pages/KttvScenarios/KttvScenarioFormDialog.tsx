import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type SubmitHandler, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ChevronDown, Loader2, Pen, Plus, Search } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { kttvScenarioService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer, MapLayerListData } from '@/types/api'
import type { FloodScenario, FloodScenarioWriteBody } from '@/service/kttvScenarioService'
import { useDebounce } from '@/hooks/useDebounce'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import {
  SCENARIO_TYPE_LIST,
  RCP_OPTION_LIST,
  type ScenarioTypeId,
  type RcpOptionId,
  type RcpOption,
} from './constants'
import { inferScenarioType } from './helpers'

export function findDefaultLayerCode(items: MapLayer[], type: ScenarioTypeId): string {
  if (!items || items.length === 0) return ''

  const keywordsByType: Record<ScenarioTypeId, string[]> = {
    hien_trang: ['hien_trang', 'hientrang', 'ngap_lut', 'ngap', 'flood'],
    cai_tao: ['cai_tao', 'caitao', 'sau_cai_tao', 'thoat_nuoc', 'thoatnuoc'],
    quy_hoach: ['quy_hoach', 'quyhoach', '2050', 'rcp'],
  }

  const keywords = keywordsByType[type] || []
  for (const kw of keywords) {
    const found = items.find((l) => {
      const c = (l.code || '').toLowerCase()
      const n = (l.name_vi || '').toLowerCase()
      return c.includes(kw) || n.includes(kw)
    })
    if (found) return found.code
  }

  return items[0]?.code ?? ''
}

interface LayerComboboxProps {
  value: string
  onChange: (v: string) => void
  items: MapLayer[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  open: boolean
  onOpenChange: (v: boolean) => void
  fallbackLabel?: string
}

function LayerCombobox({
  value,
  onChange,
  items,
  isLoading,
  search,
  onSearchChange,
  open,
  onOpenChange,
  fallbackLabel,
}: LayerComboboxProps) {
  const selected = items.find((l) => l.code === value)
  const displayCode = selected?.code || value
  const displayName = selected?.name_vi ?? fallbackLabel ?? value

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {value ? (
            <span>
              <span className="text-muted-foreground mr-2 font-mono text-xs">
                [{displayCode}]
              </span>
              {displayName}
            </span>
          ) : (
            <span className="text-muted-foreground">Chọn lớp bản đồ</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="placeholder:text-muted-foreground flex h-10 w-full bg-transparent py-3 text-sm outline-none"
            placeholder="Tìm lớp bản đồ..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="h-52">
          <div className="p-1">
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
              </div>
            ) : items.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                Không tìm thấy lớp nào.
              </div>
            ) : (
              items.map((layer) => (
                <button
                  key={layer.code}
                  type="button"
                  onClick={() => {
                    onChange(layer.code)
                    onOpenChange(false)
                    onSearchChange('')
                  }}
                  className={`hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-sm ${value === layer.code ? 'bg-accent' : ''}`}
                >
                  <span className="text-muted-foreground mr-2 font-mono text-xs">[{layer.code}]</span>
                  {layer.name_vi ?? layer.code}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const optionalNum = z
  .string()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || !isNaN(Number(v)), { message: 'Phải là số hợp lệ' })

const requiredNum = z
  .string()
  .min(1, 'Lượng mưa tối thiểu là bắt buộc')
  .refine((v) => !isNaN(Number(v)), { message: 'Phải là số hợp lệ' })

const scenarioSchema = z.object({
  code: z.string().trim().min(1, 'Mã kịch bản là bắt buộc').max(100),
  name_vi: z.string().trim().min(1, 'Tên kịch bản là bắt buộc').max(200),
  min_rainfall: requiredNum,
  max_rainfall: optionalNum,
  min_tide: optionalNum,
  max_tide: optionalNum,
  layer_code: z.string().trim().min(1, 'Mã lớp bản đồ là bắt buộc'),
  description: z.string().optional().or(z.literal('')),
  is_active: z.boolean(),
})

type ScenarioFormInputValues = z.input<typeof scenarioSchema>
type ScenarioFormValues = z.output<typeof scenarioSchema>

interface KttvScenarioFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenarioId?: number | string | null
  initialScenario?: FloodScenario | null
  defaultType?: ScenarioTypeId
  defaultLayerCode?: string
  onSaved?: () => void
}

function scenarioFromResponse(response: ApiResponse<any> | undefined): FloodScenario | null {
  const data = response?.data
  if (!data) return null
  return (data.scenario ?? data.floodScenario ?? data.item ?? data) as FloodScenario
}

const DEFAULT_VALUES: ScenarioFormInputValues = {
  code: '',
  name_vi: '',
  min_rainfall: '',
  max_rainfall: '',
  min_tide: '',
  max_tide: '',
  layer_code: '',
  description: '',
  is_active: true,
}

export default function KttvScenarioFormDialog({
  open,
  onOpenChange,
  scenarioId,
  initialScenario,
  defaultType = 'hien_trang',
  defaultLayerCode,
  onSaved,
}: KttvScenarioFormDialogProps) {
  const isEdit = scenarioId !== null && scenarioId !== undefined

  const detailQuery = useApiQuery(
    ['flood-scenario-detail', scenarioId],
    () => kttvScenarioService.getById(scenarioId!),
    { enabled: isEdit && open, staleTime: 0 },
    false,
    false
  )

  const scenario =
    scenarioFromResponse(detailQuery.data as ApiResponse<any> | undefined) ?? initialScenario ?? null

  const [scenarioType, setScenarioType] = useState<ScenarioTypeId>(defaultType)
  const [rcpOption, setRcpOption] = useState<RcpOptionId>('rcp45')
  const [isLayerManuallySelected, setIsLayerManuallySelected] = useState(false)

  const [layerSearch, setLayerSearch] = useState('')
  const [layerPopoverOpen, setLayerPopoverOpen] = useState(false)
  const layerSearchDebounced = useDebounce(layerSearch, 300)

  const layersQuery = useApiQuery(
    ['map-layers-dropdown', layerSearchDebounced],
    () =>
      mapLayerService.getAll({
        page: 1,
        limit: 100,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        q: layerSearchDebounced || undefined,
      }),
    { staleTime: 60 * 1000 },
    false,
    false
  )

  const rawLayerItems: MapLayer[] = useMemo(() => {
    const d = (layersQuery.data as ApiResponse<MapLayerListData> | undefined)?.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return d?.items ?? d?.mapLayers ?? []
  }, [layersQuery.data])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ScenarioFormInputValues, unknown, ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const initializedScenarioIdRef = useRef<number | string | null | undefined>(undefined)
  const hasInitializedCreateRef = useRef(false)
  const [knownLayers, setKnownLayers] = useState<Record<string, MapLayer>>({})

  useEffect(() => {
    if (rawLayerItems.length > 0) {
      setKnownLayers((prev) => {
        let changed = false
        const next = { ...prev }
        for (const item of rawLayerItems) {
          if (item.code && (!next[item.code] || next[item.code].name_vi !== item.name_vi)) {
            next[item.code] = item
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [rawLayerItems])

  const watchLayerCode = watch('layer_code')

  const layerItems: MapLayer[] = useMemo(() => {
    const list = [...rawLayerItems]
    const activeCode = watchLayerCode || scenario?.layer_code
    if (activeCode && !list.some((l) => l.code === activeCode)) {
      const known = knownLayers[activeCode]
      const isScenarioLayer =
        scenario?.layer_code === activeCode || scenario?.layer?.code === activeCode
      const resolvedName =
        known?.name_vi ||
        (isScenarioLayer ? scenario?.layer?.nameVi || scenario?.name_vi : undefined) ||
        activeCode

      list.unshift({
        id: (known?.id ?? scenario?.layer?.id ?? 0) as any,
        code: activeCode,
        name_vi: resolvedName,
      } as unknown as MapLayer)
    }
    return list
  }, [rawLayerItems, watchLayerCode, scenario, knownLayers])

  const activeFallbackLabel = useMemo(() => {
    const activeCode = watchLayerCode || scenario?.layer_code
    if (!activeCode) return undefined
    if (knownLayers[activeCode]?.name_vi) {
      return knownLayers[activeCode].name_vi
    }
    if (scenario?.layer_code === activeCode || scenario?.layer?.code === activeCode) {
      return scenario?.layer?.nameVi || scenario?.name_vi
    }
    return undefined
  }, [watchLayerCode, scenario, knownLayers])

  useEffect(() => {
    if (!open) {
      reset(DEFAULT_VALUES)
      setIsLayerManuallySelected(false)
      setLayerSearch('')
      initializedScenarioIdRef.current = undefined
      hasInitializedCreateRef.current = false
      return
    }

    if (isEdit) {
      if (scenario && initializedScenarioIdRef.current !== scenario.id) {
        const resolvedType = scenario.type ?? inferScenarioType(scenario).type ?? defaultType
        const resolvedRcp = scenario.rcp ?? inferScenarioType(scenario).rcp ?? 'rcp45'
        setScenarioType(resolvedType)
        setRcpOption(resolvedRcp)
        const existingLayer =
          scenario.layer_code || defaultLayerCode || findDefaultLayerCode(rawLayerItems, resolvedType) || ''
        reset({
          code: scenario.code ?? '',
          name_vi: scenario.name_vi ?? '',
          min_rainfall: scenario.min_rainfall == null ? '' : String(scenario.min_rainfall),
          max_rainfall: scenario.max_rainfall == null ? '' : String(scenario.max_rainfall),
          min_tide: scenario.min_tide == null ? '' : String(scenario.min_tide),
          max_tide: scenario.max_tide == null ? '' : String(scenario.max_tide),
          layer_code: existingLayer,
          description: scenario.description ?? '',
          is_active: scenario.is_active !== false,
        })
        initializedScenarioIdRef.current = scenario.id
      }
    } else {
      if (!hasInitializedCreateRef.current) {
        setScenarioType(defaultType)
        setRcpOption('rcp45')
        const initialLayer = defaultLayerCode || findDefaultLayerCode(rawLayerItems, defaultType)
        reset({
          ...DEFAULT_VALUES,
          layer_code: initialLayer,
        })
        hasInitializedCreateRef.current = true
      }
    }
  }, [defaultType, defaultLayerCode, isEdit, open, reset, scenario, rawLayerItems])

  // Khi danh sách layer tải về sau khi mở form ở Create mode, tự điền layer mặc định nếu chưa có
  useEffect(() => {
    if (!isEdit && open && !watchLayerCode && !isLayerManuallySelected && rawLayerItems.length > 0) {
      const autoLayer = defaultLayerCode || findDefaultLayerCode(rawLayerItems, scenarioType)
      if (autoLayer) {
        setValue('layer_code', autoLayer, { shouldValidate: true })
      }
    }
  }, [isEdit, open, watchLayerCode, isLayerManuallySelected, rawLayerItems, defaultLayerCode, scenarioType, setValue])

  const nameViValue = useWatch({ control, name: 'name_vi' })
  useEffect(() => {
    if (!isEdit) {
      setValue('code', slugify(nameViValue ?? ''), { shouldValidate: false })
    }
  }, [nameViValue, isEdit, setValue])

  const createMutation = useApiMutation(
    (payload: FloodScenarioWriteBody) => kttvScenarioService.create(payload),
    {
      onSuccess: () => {
        toast.success('Tạo kịch bản ngập úng thành công')
        onSaved?.()
        onOpenChange(false)
      },
    },
    false
  )

  const updateMutation = useApiMutation(
    (payload: FloodScenarioWriteBody) => kttvScenarioService.update(scenarioId!, payload),
    {
      onSuccess: () => {
        toast.success('Cập nhật kịch bản ngập úng thành công')
        onSaved?.()
        onOpenChange(false)
      },
    },
    false
  )

  const errorMessage = useMemo(() => {
    if (!detailQuery.error) return ''
    return getMappedErrorMessage(detailQuery.error, 'Không tải được chi tiết kịch bản')
  }, [detailQuery.error])

  const submitting = createMutation.isPending || updateMutation.isPending

  const toNum = (v: string | null | undefined) =>
    v === null || v === undefined || v === '' ? null : Number(v)

  const handleFormSubmit: SubmitHandler<ScenarioFormValues> = (values) => {
    const payload: FloodScenarioWriteBody = {
      code: values.code.trim(),
      nameVi: values.name_vi.trim(),
      type: scenarioType,
      rcp: scenarioType === 'quy_hoach' ? rcpOption : null,
      layerCode: values.layer_code.trim(),
      description: values.description?.trim() || null,
      isActive: values.is_active,
      minRainfall: toNum(values.min_rainfall),
      maxRainfall: toNum(values.max_rainfall),
      minTide: toNum(values.min_tide),
      maxTide: toNum(values.max_tide),
    }

    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              {isEdit ? (
                <Pen className="text-primary h-5 w-5" />
              ) : (
                <Plus className="text-primary h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isEdit ? 'Chỉnh sửa kịch bản ngập lụt' : 'Thêm kịch bản ngập lụt'}
              </DialogTitle>
              <DialogDescription>
                {isEdit ? `Cập nhật kịch bản #${scenarioId}` : 'Nhập thông tin để tạo kịch bản mới'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isEdit && detailQuery.isLoading && !scenario && (
          <div className="flex items-center justify-center gap-2 py-10">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
            <span className="text-muted-foreground text-sm">Đang tải dữ liệu...</span>
          </div>
        )}

        {isEdit && errorMessage && !scenario && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {(!isEdit || scenario) && (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Phân loại 3 kịch bản thủy văn */}
            <div
              className={`grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-3 ${
                scenarioType === 'quy_hoach' ? 'sm:grid-cols-2' : ''
              }`}
            >
              <div className="space-y-1.5">
                <Label htmlFor="scenario_type" className="text-xs font-semibold">
                  Phân loại kịch bản
                </Label>
                <Select
                  value={scenarioType}
                  onValueChange={(val) => {
                    const nextType = val as ScenarioTypeId
                    setScenarioType(nextType)
                    if (!isEdit && !isLayerManuallySelected && rawLayerItems.length > 0) {
                      const matchedLayer = findDefaultLayerCode(rawLayerItems, nextType)
                      if (matchedLayer) {
                        setValue('layer_code', matchedLayer, { shouldValidate: true })
                      }
                    }
                  }}
                >
                  <SelectTrigger id="scenario_type" className="w-full">
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
                  <Label htmlFor="rcp_option" className="text-xs font-semibold">
                    Nhánh kịch bản biến đổi khí hậu
                  </Label>
                  <Select
                    value={rcpOption}
                    onValueChange={(val) => setRcpOption(val as RcpOptionId)}
                  >
                    <SelectTrigger id="rcp_option" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RCP_OPTION_LIST.map((r: RcpOption) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label} ({r.description})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Mã kịch bản <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="scenario_light"
                  className="font-mono"
                />
                {!isEdit && (
                  <p className="text-muted-foreground text-xs">Tự sinh từ tên, có thể chỉnh sửa.</p>
                )}
                {errors.code && <p className="text-destructive text-sm">{errors.code.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={watch('is_active') ? 'true' : 'false'}
                  onValueChange={(v) => setValue('is_active', v === 'true')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Kích hoạt</SelectItem>
                    <SelectItem value="false">Vô hiệu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_vi">
                Tên kịch bản <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name_vi"
                {...register('name_vi')}
                placeholder="Kịch bản ngập nhẹ (Mưa < 50mm)"
              />
              {errors.name_vi && (
                <p className="text-destructive text-sm">{errors.name_vi.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_rainfall">Lượng mưa tối thiểu (mm)</Label>
                <Input
                  id="min_rainfall"
                  {...register('min_rainfall')}
                  placeholder="0"
                  inputMode="decimal"
                />
                {errors.min_rainfall && (
                  <p className="text-destructive text-sm">
                    {errors.min_rainfall.message as string}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_rainfall">Lượng mưa tối đa (mm)</Label>
                <Input
                  id="max_rainfall"
                  {...register('max_rainfall')}
                  placeholder="49.99 (để trống = không giới hạn)"
                  inputMode="decimal"
                />
                {errors.max_rainfall && (
                  <p className="text-destructive text-sm">
                    {errors.max_rainfall.message as string}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_tide">Triều tối thiểu (m)</Label>
                <Input
                  id="min_tide"
                  {...register('min_tide')}
                  placeholder="để trống = không giới hạn"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_tide">Triều tối đa (m)</Label>
                <Input
                  id="max_tide"
                  {...register('max_tide')}
                  placeholder="1.99"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Lớp bản đồ liên kết <span className="text-destructive">*</span>
              </Label>
              <LayerCombobox
                value={watch('layer_code')}
                onChange={(v) => {
                  setIsLayerManuallySelected(true)
                  setValue('layer_code', v, { shouldValidate: true })
                }}
                items={layerItems}
                isLoading={layersQuery.isLoading}
                search={layerSearch}
                onSearchChange={setLayerSearch}
                open={layerPopoverOpen}
                onOpenChange={setLayerPopoverOpen}
                fallbackLabel={activeFallbackLabel}
              />
              {errors.layer_code && (
                <p className="text-destructive text-sm">{errors.layer_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Kịch bản mưa nhỏ và triều thấp"
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
