import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Gauge, KeyRound, Layers, Loader2, Save, Search, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { mapLayerService, useApiQuery } from '@/service'
import { useDebounce } from '@/hooks/useDebounce'
import type { ApiResponse, CreateMapLayerApiBody, MapLayer, MapLayerApi } from '@/types/api'
import {
  buildUpdatePayload,
  createMapLayerApiSchema,
  editMapLayerApiFormSchema,
  normalizeMapLayerApiInput,
} from '@/validators/mapLayerApiValidators'

interface MapLayerApiFormProps {
  mode: 'create' | 'edit'
  initialData?: MapLayerApi | null
  submitting?: boolean
  onSubmitCreate: (payload: CreateMapLayerApiBody) => void
  onSubmitUpdate: (payload: Partial<CreateMapLayerApiBody>) => void
  onCancel?: () => void
}

type FormValues = z.infer<typeof createMapLayerApiSchema>

const defaultValues: FormValues = {
  name: '',
  layer_id: 0,
  scope: {
    read: true,
    rate_per_min: 60,
  },
  is_active: true,
  expires_at: null,
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as
    | ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]>
    | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function layerLabel(layer: MapLayer) {
  return layer.name_vi || layer.name || layer.code
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="text-primary h-4 w-4" />
      <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
    </div>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs leading-relaxed">{children}</p>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

export default function MapLayerApiForm({
  mode,
  initialData,
  submitting = false,
  onSubmitCreate,
  onSubmitUpdate,
  onCancel,
}: MapLayerApiFormProps) {
  const [layerSearch, setLayerSearch] = useState('')
  const debouncedLayerSearch = useDebounce(layerSearch, 300)
  const layerQuery = useApiQuery(
    ['map-layers-for-map-api-form', debouncedLayerSearch],
    () =>
      mapLayerService.getAll({
        page: 1,
        limit: 10,
        ...(debouncedLayerSearch.trim() ? { q: debouncedLayerSearch.trim() } : {}),
      }),
    {},
    false,
    false
  )
  const selectedLayerQuery = useApiQuery(
    ['map-layer-for-map-api-form-selected', initialData?.layer_id],
    () => mapLayerService.getById(initialData!.layer_id!),
    { enabled: mode === 'edit' && initialData?.layer_id != null },
    false,
    false
  )
  const layers = useMemo(() => {
    const listed = getLayerItems(layerQuery.data)
    const selected = (selectedLayerQuery.data as ApiResponse<MapLayer> | undefined)?.data
    if (!selected || listed.some((layer) => String(layer.id) === String(selected.id))) return listed
    return [selected, ...listed]
  }, [layerQuery.data, selectedLayerQuery.data])

  type FormInputValues = z.input<typeof createMapLayerApiSchema> | z.input<typeof editMapLayerApiFormSchema>
  type FormValues = z.output<typeof createMapLayerApiSchema> | z.output<typeof editMapLayerApiFormSchema>

  const form = useForm<FormInputValues, unknown, FormValues>({
    resolver: zodResolver(mode === 'edit' ? editMapLayerApiFormSchema : createMapLayerApiSchema),
    mode: 'onChange',
    defaultValues,
  })

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.reset({
        name: initialData.name,
        layer_id: initialData.layer_id == null ? undefined : Number(initialData.layer_id),
        scope: {
          read: initialData.scope?.read !== false,
          rate_per_min: Number(initialData.scope?.rate_per_min ?? 60),
          bbox_limit:
            initialData.scope?.bbox_limit == null
              ? undefined
              : Number(initialData.scope.bbox_limit),
        },
        is_active: initialData.is_active !== false,
        expires_at: initialData.expires_at ? new Date(initialData.expires_at).toISOString() : null,
      })
      return
    }

    form.reset(defaultValues)
  }, [mode, initialData, form])

  const watched = form.watch()

  const changedPayload = useMemo(() => {
    if (mode !== 'edit' || !initialData) return {}
    const original: CreateMapLayerApiBody = {
      name: initialData.name,
      layer_id: initialData.layer_id == null ? 0 : Number(initialData.layer_id),
      scope: {
        read: initialData.scope?.read !== false,
        rate_per_min: Number(initialData.scope?.rate_per_min ?? 60),
        ...(initialData.scope?.bbox_limit != null
          ? { bbox_limit: Number(initialData.scope.bbox_limit) }
          : {}),
      },
      is_active: initialData.is_active !== false,
      expires_at: initialData.expires_at ?? null,
    }

    return buildUpdatePayload(original, normalizeMapLayerApiInput(watched))
  }, [mode, initialData, watched])

  const selectedLayerId = form.watch('layer_id')
  const selectedLayer = layers.find((layer) => String(layer.id) === String(selectedLayerId))

  const [layerPopoverOpen, setLayerPopoverOpen] = useState(false)

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        const normalized = normalizeMapLayerApiInput(values)
        if (mode === 'create') {
          onSubmitCreate({
            ...normalized,
            metadata: selectedLayer?.metadata ?? undefined,
          })
          return
        }

        const { layer_id: _layerId, ...patch } = changedPayload as CreateMapLayerApiBody & Record<string, unknown>
        onSubmitUpdate(patch as Partial<CreateMapLayerApiBody>)
      })}
    >
      <SectionHeader icon={Layers} title="Lớp dữ liệu được chia sẻ" />
      <Separator />

      <div className="space-y-2">
        <Label htmlFor="map-api-layer-trigger">
          Lớp bản đồ <span className="text-destructive">*</span>
        </Label>
        <Popover open={layerPopoverOpen} onOpenChange={setLayerPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              id="map-api-layer-trigger"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={layerPopoverOpen}
              aria-controls="map-api-layer-options"
              disabled={mode === 'edit'}
              className="w-full justify-between font-normal"
            >
                <span className={selectedLayer ? '' : 'text-muted-foreground'}>
                  {selectedLayer
                    ? `[${selectedLayer.code}] ${layerLabel(selectedLayer)}`
                    : 'Chọn lớp bản đồ'}
                </span>
                <Layers className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 size-4 shrink-0 opacity-50" />
                <Input
                  aria-label="Tìm lớp bản đồ"
                  value={layerSearch}
                  onChange={(event) => setLayerSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã lớp..."
                  className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                />
                {layerSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa tìm kiếm lớp bản đồ"
                    onClick={() => setLayerSearch('')}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              <div
                id="map-api-layer-options"
                className="max-h-64 overflow-y-auto p-1"
                role="listbox"
                aria-label="Danh sách lớp bản đồ"
              >
                {layerQuery.isLoading || selectedLayerQuery.isLoading ? (
                  <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Đang tải lớp dữ liệu...
                  </div>
                ) : layerQuery.isError || selectedLayerQuery.isError ? (
                  <div className="text-destructive px-3 py-6 text-center text-sm">
                    Không thể tải danh sách lớp dữ liệu.
                  </div>
                ) : layers.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                    Không tìm thấy lớp phù hợp.
                  </div>
                ) : (
                  layers.map((layer) => {
                    const layerId = String(layer.id)
                    const isSelected = layerId === String(selectedLayerId)
                    return (
                      <button
                        key={layerId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          if (layer.id == null) return
                          form.setValue('layer_id', Number(layer.id), {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                          setLayerSearch('')
                        }}
                        className={`hover:bg-accent flex w-full items-start rounded-sm px-3 py-2 text-left text-sm ${isSelected ? 'bg-accent' : ''}`}
                      >
                        <span>
                          <span className="block font-medium">{layerLabel(layer)}</span>
                          <span className="text-muted-foreground block font-mono text-xs">
                            [{layer.code}] · {layer.geometry_type ?? 'Không rõ kiểu hình học'}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          <FieldHint>
            {mode === 'edit'
              ? 'Lớp liên kết không thể thay đổi sau khi tạo API.'
              : 'Tìm theo tên hoặc mã lớp; hệ thống sẽ lưu ID lớp do Server trả về.'}
          </FieldHint>
          {selectedLayer && (
            <FieldHint>
              Nhóm: {selectedLayer.category_name ?? selectedLayer.category ?? 'Chưa phân nhóm'} · Kiểu hình học:{' '}
              {selectedLayer.geometry_type ?? 'Chưa xác định'}
            </FieldHint>
          )}
          <FieldError message={form.formState.errors.layer_id?.message} />
        </div>

      <SectionHeader icon={KeyRound} title="Thông tin API key" />
      <Separator />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Tên gợi nhớ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...form.register('name')}
            placeholder="VD: Key chia sẻ ranh giới rừng"
          />
          <FieldHint>Tên dùng để nhận diện đơn vị hoặc mục đích sử dụng key.</FieldHint>
          <FieldError message={form.formState.errors.name?.message} />
        </div>

        <div className="space-y-2">
          <Label>Trạng thái</Label>
          <Select
            value={form.watch('is_active') ? 'true' : 'false'}
            onValueChange={(value) =>
              form.setValue('is_active', value === 'true', {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Đang hoạt động</SelectItem>
              <SelectItem value="false">Tạm dừng</SelectItem>
            </SelectContent>
          </Select>
          <FieldHint>Tạm dừng sẽ khiến đối tác không thể dùng key để đọc dữ liệu.</FieldHint>
        </div>
      </div>

      <SectionHeader icon={Gauge} title="Giới hạn truy cập" />
      <Separator />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="rate-per-min">Request/phút</Label>
          <Input
            id="rate-per-min"
            type="number"
            min={1}
            max={6000}
            {...form.register('scope.rate_per_min', { valueAsNumber: true })}
          />
          <FieldHint>Mặc định hệ thống cho phép 60 yêu cầu/phút.</FieldHint>
          <FieldError message={form.formState.errors.scope?.rate_per_min?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bbox-limit">Giới hạn bbox</Label>
          <Input
            id="bbox-limit"
            type="number"
            min={0}
            max={360}
            step="0.01"
            placeholder="Không giới hạn"
            {...form.register('scope.bbox_limit', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
          />
          <FieldHint>Đơn vị độ vuông; bỏ trống nếu không cần giới hạn vùng truy vấn.</FieldHint>
          <FieldError message={form.formState.errors.scope?.bbox_limit?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expires-at">Ngày hết hạn</Label>
          <Input
            id="expires-at"
            type="datetime-local"
            value={toDatetimeLocal(form.watch('expires_at'))}
            onChange={(event) => {
              const value = event.target.value
              form.setValue('expires_at', value ? new Date(value).toISOString() : null, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }}
          />
          <FieldHint>Bỏ trống nếu key không hết hạn.</FieldHint>
          <FieldError message={form.formState.errors.expires_at?.message} />
        </div>
      </div>

      <div className="bg-muted/50 rounded-md border p-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground">
            Mã khóa đầy đủ chỉ hiển thị một lần khi tạo hoặc cấp lại. Hệ thống chỉ lưu bản đã bảo vệ
            và các ký tự nhận diện.
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Hủy
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting || (mode === 'edit' && Object.keys(changedPayload).length === 0)}
            className="min-w-32"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {mode === 'create' ? 'Tạo API key' : 'Cập nhật'}
              </span>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
