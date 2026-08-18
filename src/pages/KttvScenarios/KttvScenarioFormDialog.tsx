import { useEffect, useMemo, useState } from 'react'
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
import { kttvScenarioService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer, MapLayerListData } from '@/types/api'
import type { FloodScenario, FloodScenarioWriteBody } from '@/service/kttvScenarioService'
import { useDebounce } from '@/hooks/useDebounce'

interface LayerComboboxProps {
  value: string
  onChange: (v: string) => void
  items: MapLayer[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  open: boolean
  onOpenChange: (v: boolean) => void
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
}: LayerComboboxProps) {
  const selected = items.find((l) => l.code === value)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected ? (
            <span>
              <span className="text-muted-foreground mr-2 font-mono text-xs">
                [{selected.code}]
              </span>
              {selected.name_vi ?? selected.code}
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
        <div className="max-h-52 overflow-y-auto p-1">
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

type ScenarioFormValues = z.infer<typeof scenarioSchema>

interface KttvScenarioFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenarioId: number | string | null
  onSaved?: () => void
}

function scenarioFromResponse(response: ApiResponse<any> | undefined): FloodScenario | null {
  const data = response?.data
  if (!data) return null
  return (data.scenario ?? data.floodScenario ?? data.item ?? data) as FloodScenario
}

const DEFAULT_VALUES: ScenarioFormValues = {
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

  const scenario = scenarioFromResponse(detailQuery.data as ApiResponse<any> | undefined)

  const [layerSearch, setLayerSearch] = useState('')
  const [layerPopoverOpen, setLayerPopoverOpen] = useState(false)
  const layerSearchDebounced = useDebounce(layerSearch, 300)

  const layersQuery = useApiQuery(
    ['map-layers-dropdown', layerSearchDebounced],
    () =>
      mapLayerService.getAll({
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        q: layerSearchDebounced || undefined,
      }),
    { staleTime: 60 * 1000 },
    false,
    false
  )
  const layerItems: MapLayer[] = (() => {
    const d = (layersQuery.data as ApiResponse<MapLayerListData> | undefined)?.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return d?.items ?? (d as any)?.mapLayers ?? []
  })()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema) as any,
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (!open) {
      reset(DEFAULT_VALUES)
      return
    }
    if (scenario) {
      reset({
        code: scenario.code ?? '',
        name_vi: scenario.name_vi ?? '',
        min_rainfall: scenario.min_rainfall ?? '',
        max_rainfall: scenario.max_rainfall ?? '',
        min_tide: scenario.min_tide ?? '',
        max_tide: scenario.max_tide ?? '',
        layer_code: scenario.layer_code ?? '',
        description: scenario.description ?? '',
        is_active: scenario.is_active !== false,
      })
    } else if (!isEdit) {
      reset(DEFAULT_VALUES)
    }
  }, [isEdit, open, reset, scenario])

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
    const err = detailQuery.error as any
    return err?.body?.message || err?.message || ''
  }, [detailQuery.error])

  const submitting = createMutation.isPending || updateMutation.isPending

  const toNum = (v: string | null | undefined) =>
    v === null || v === undefined || v === '' ? null : Number(v)

  const handleFormSubmit: SubmitHandler<ScenarioFormValues> = (values) => {
    const payload: FloodScenarioWriteBody = {
      code: values.code.trim(),
      nameVi: values.name_vi.trim(),
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
                onChange={(v) => setValue('layer_code', v, { shouldValidate: true })}
                items={layerItems}
                isLoading={layersQuery.isLoading}
                search={layerSearch}
                onSearchChange={setLayerSearch}
                open={layerPopoverOpen}
                onOpenChange={setLayerPopoverOpen}
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
