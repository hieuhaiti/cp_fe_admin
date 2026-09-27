import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-toastify'
import {
  AlertCircle,
  Gauge,
  KeyRound,
  Layers,
  Loader2,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { mapLayerApiService, mapLayerService, useApiQuery } from '@/service'
import { useDebounce } from '@/hooks/useDebounce'
import type { ApiResponse, CreateMapLayerApiBody, MapApi, MapApiListData, MapLayer, MapLayerApi } from '@/types/api'
import {
  buildUpdatePayload,
  createMapLayerApiSchema,
  editMapLayerApiFormSchema,
  normalizeMapLayerApiInput,
} from '@/validators/mapLayerApiValidators'

interface MapLayerApiFormProps {
  mode: 'create' | 'edit'
  initialData?: MapLayerApi | null
  initialLayerId?: number | null
  submitting?: boolean
  onSubmitCreate: (payload: CreateMapLayerApiBody) => void
  onSubmitUpdate: (payload: Partial<CreateMapLayerApiBody>) => void
  onCancel?: () => void
}

type FormValues = z.infer<typeof createMapLayerApiSchema>

const defaultValues: FormValues = {
  name: '',
  consumer: '',
  keyName: '',
  layer_id: 0,
  slug: '',
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

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="text-primary h-4 w-4" />
      <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
    </div>
  )
}

function FieldHint({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-muted-foreground text-xs leading-relaxed ${className}`}>{children}</p>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

export default function MapLayerApiForm({
  mode,
  initialData,
  initialLayerId,
  submitting = false,
  onSubmitCreate,
  onSubmitUpdate,
  onCancel,
}: MapLayerApiFormProps) {
  const [layerSearch, setLayerSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [chosenLayer, setChosenLayer] = useState<MapLayer | null>(null)
  const debouncedLayerSearch = useDebounce(layerSearch, 300)

  // 1. Fetch layer options
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

  // 2. Fetch selected layer if editing or if initialLayerId is provided in create mode
  const targetLayerId = mode === 'edit' ? initialData?.layer_id : initialLayerId
  const selectedLayerQuery = useApiQuery(
    ['map-layer-for-map-api-form-selected', targetLayerId],
    () => mapLayerService.getById(targetLayerId!),
    { enabled: Boolean(targetLayerId && Number(targetLayerId) > 0) },
    false,
    false
  )

  useEffect(() => {
    if (mode === 'create' && initialLayerId && selectedLayerQuery.data?.data) {
      setChosenLayer(selectedLayerQuery.data.data)
    }
  }, [mode, initialLayerId, selectedLayerQuery.data])

  // 3. Fetch existing registries to detect duplicate layer registration
  const allRegistriesQuery = useApiQuery(
    ['all-registered-apis-for-form'],
    () => mapLayerApiService.getAll({ limit: 100 }),
    { staleTime: 60 * 1000 },
    false,
    false
  )
  const existingRegistries = useMemo(() => {
    const raw = (allRegistriesQuery.data as ApiResponse<MapApiListData> | undefined)?.data
    return raw?.items ?? raw?.apis ?? []
  }, [allRegistriesQuery.data])

  const existingRegistryMap = useMemo(() => {
    const map = new Map<number, MapApi>()
    existingRegistries.forEach((reg) => {
      if (reg.layer_id != null) {
        map.set(Number(reg.layer_id), reg)
      }
    })
    return map
  }, [existingRegistries])

  const layers = useMemo(() => {
    const listed = getLayerItems(layerQuery.data)
    const selected = (selectedLayerQuery.data as ApiResponse<MapLayer> | undefined)?.data ?? chosenLayer
    if (!selected || listed.some((layer) => String(layer.id) === String(selected.id))) return listed
    return [selected, ...listed]
  }, [layerQuery.data, selectedLayerQuery.data, chosenLayer])

  type FormInputValues = z.input<typeof createMapLayerApiSchema> | z.input<typeof editMapLayerApiFormSchema>
  type FormValues = z.output<typeof createMapLayerApiSchema> | z.output<typeof editMapLayerApiFormSchema>

  const form = useForm<FormInputValues, unknown, FormValues>({
    resolver: zodResolver(mode === 'edit' ? editMapLayerApiFormSchema : createMapLayerApiSchema),
    mode: 'onChange',
    defaultValues: {
      ...defaultValues,
      ...(mode === 'create' && initialLayerId ? { layer_id: Number(initialLayerId) } : {}),
    },
  })

  // Local field configuration state
  const [selectedReadFields, setSelectedReadFields] = useState<string[]>([])
  const [selectedWriteFields, setSelectedWriteFields] = useState<string[]>([])
  const [selectedSearchFields, setSelectedSearchFields] = useState<string[]>([])
  const [selectedAllowedMethods, setSelectedAllowedMethods] = useState<string[]>(['GET'])
  const [defaultSortField, setDefaultSortField] = useState<string>('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['features:read'])
  const [readFieldFilter, setReadFieldFilter] = useState('')
  const [writeFieldFilter, setWriteFieldFilter] = useState('')
  const [searchFieldFilter, setSearchFieldFilter] = useState('')

  const selectedLayerId = form.watch('layer_id')
  const selectedLayer = useMemo(() => {
    if (chosenLayer && String(chosenLayer.id) === String(selectedLayerId)) {
      return chosenLayer
    }
    return layers.find((layer) => String(layer.id) === String(selectedLayerId))
  }, [chosenLayer, layers, selectedLayerId])

  const existingRegistryForSelected = useMemo(() => {
    if (!selectedLayerId) return null
    return existingRegistryMap.get(Number(selectedLayerId)) ?? null
  }, [existingRegistryMap, selectedLayerId])

  const selectedLayerDisplayFields = useMemo(() => {
    const raw = selectedLayer?.metadata?.displayFields ?? selectedLayer?.metadata?.display_fields
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string' && Boolean(item))
      : []
  }, [selectedLayer])

  const selectedLayerEditableFields = useMemo(() => {
    const raw = selectedLayer?.metadata?.editableFields ?? selectedLayer?.metadata?.editable_fields
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string' && Boolean(item))
      : []
  }, [selectedLayer])

  const selectedLayerAllowedSearchFields = useMemo(() => {
    const raw = selectedLayer?.metadata?.searchFields ?? selectedLayer?.metadata?.search_fields
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string' && Boolean(item))
      : []
  }, [selectedLayer])

  const filteredReadFields = useMemo(() => {
    if (!readFieldFilter.trim()) return selectedLayerDisplayFields
    const q = readFieldFilter.trim().toLowerCase()
    return selectedLayerDisplayFields.filter((f) => f.toLowerCase().includes(q))
  }, [selectedLayerDisplayFields, readFieldFilter])

  const filteredWriteFields = useMemo(() => {
    if (!writeFieldFilter.trim()) return selectedReadFields
    const q = writeFieldFilter.trim().toLowerCase()
    return selectedReadFields.filter((f) => f.toLowerCase().includes(q))
  }, [selectedReadFields, writeFieldFilter])

  const availableSearchCandidates = useMemo(() => {
    return selectedLayerAllowedSearchFields.filter((f) => selectedReadFields.includes(f))
  }, [selectedLayerAllowedSearchFields, selectedReadFields])

  const filteredSearchFields = useMemo(() => {
    if (!searchFieldFilter.trim()) return availableSearchCandidates
    const q = searchFieldFilter.trim().toLowerCase()
    return availableSearchCandidates.filter((f) => f.toLowerCase().includes(q))
  }, [availableSearchCandidates, searchFieldFilter])

  const handleToggleMethod = (method: 'GET' | 'POST' | 'PUT' | 'DELETE') => {
    if (method === 'GET') {
      // GET is always required for API registry
      return
    }
    const isCurrentlySelected = selectedAllowedMethods.includes(method)
    let nextMethods: string[]
    if (isCurrentlySelected) {
      nextMethods = selectedAllowedMethods.filter((m) => m !== method)
    } else {
      nextMethods = [...selectedAllowedMethods, method]
    }
    setSelectedAllowedMethods(nextMethods)

    const hasWrite = nextMethods.some((m) => m !== 'GET')
    if (hasWrite) {
      if (selectedWriteFields.length === 0) {
        const candidates = selectedLayerEditableFields.length > 0
          ? selectedLayerEditableFields.filter((f) => selectedReadFields.includes(f))
          : selectedReadFields
        setSelectedWriteFields(candidates.length > 0 ? candidates : selectedReadFields.slice(0, 5))
      }
    } else {
      setSelectedWriteFields([])
    }

    if (!nextMethods.includes('POST')) {
      setSelectedScopes((prev) => prev.filter((s) => s !== 'features:create'))
    }
    if (!nextMethods.includes('PUT')) {
      setSelectedScopes((prev) => prev.filter((s) => s !== 'features:update'))
    }
    if (!nextMethods.includes('DELETE')) {
      setSelectedScopes((prev) => prev.filter((s) => s !== 'features:delete'))
    }
  }

  const handleToggleScope = (scope: 'features:read' | 'features:create' | 'features:update' | 'features:delete') => {
    if (scope === 'features:read') {
      return
    }
    if (selectedScopes.includes(scope)) {
      setSelectedScopes((prev) => prev.filter((s) => s !== scope))
    } else {
      setSelectedScopes((prev) => [...prev, scope])
    }
  }

  // Sync field config when layer changes in create mode
  useEffect(() => {
    if (mode === 'create') {
      if (selectedLayerDisplayFields.length > 0) {
        setSelectedReadFields(selectedLayerDisplayFields)
        const allowedSearchDefaults = selectedLayerAllowedSearchFields
          .filter((f) => selectedLayerDisplayFields.includes(f))
          .slice(0, 3)
        setSelectedSearchFields(allowedSearchDefaults)
        setDefaultSortField(
          selectedLayerDisplayFields.includes('name') ? 'name' : selectedLayerDisplayFields[0] || ''
        )
      } else {
        setSelectedReadFields([])
        setSelectedSearchFields([])
        setDefaultSortField('')
      }
      setSelectedAllowedMethods(['GET'])
      setSelectedWriteFields([])
      setSelectedScopes(['features:read'])
    }
  }, [mode, selectedLayerId, selectedLayerDisplayFields, selectedLayerAllowedSearchFields])

  // Sync fields when editing existing API
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.reset({
        name: initialData.name,
        layer_id: initialData.layer_id == null ? undefined : Number(initialData.layer_id),
        slug: initialData.slug || '',
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

      const read = Array.isArray(initialData.read_fields) ? initialData.read_fields : []
      const write = Array.isArray(initialData.write_fields) ? initialData.write_fields : []
      const search = Array.isArray(initialData.search_fields) ? initialData.search_fields : []
      const methods = Array.isArray(initialData.allowed_methods) && initialData.allowed_methods.length > 0
        ? initialData.allowed_methods
        : ['GET']
      setSelectedReadFields(read)
      setSelectedWriteFields(write)
      setSelectedSearchFields(search)
      setSelectedAllowedMethods(methods)
      setDefaultSortField(initialData.default_sort_field || (read[0] ?? ''))
      return
    }

    if (mode === 'create') {
      const initId = initialLayerId ? Number(initialLayerId) : 0
      form.reset({
        ...defaultValues,
        layer_id: initId,
      })
      if (initId > 0) {
        form.clearErrors('layer_id')
      }
    }
  }, [mode, initialData, initialLayerId, form])

  // Auto-suggest API name and slug when selecting a layer in create mode
  useEffect(() => {
    if (mode === 'create' && selectedLayer) {
      if (existingRegistryForSelected) {
        form.setValue('name', existingRegistryForSelected.name, { shouldValidate: true })
      } else {
        if (!form.getValues('name') || form.getValues('name').startsWith('API ')) {
          const candidateName = layerLabel(selectedLayer)
          form.setValue('name', `API ${candidateName}`, { shouldValidate: true })
        }
        if (!form.getValues('slug')) {
          const candidate = selectedLayer.code || selectedLayer.name || ''
          const safe = slugify(`api-${candidate}`)
          form.setValue('slug', safe, { shouldValidate: true })
        }
      }
    }
  }, [mode, selectedLayer, existingRegistryForSelected, form])

  const watched = form.watch()
  const watchedSlug = form.watch('slug')

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

  const fieldsChangedInEdit = useMemo(() => {
    if (mode !== 'edit' || !initialData) return false
    const origRead = Array.isArray(initialData.read_fields) ? initialData.read_fields : []
    const origWrite = Array.isArray(initialData.write_fields) ? initialData.write_fields : []
    const origSearch = Array.isArray(initialData.search_fields) ? initialData.search_fields : []
    const origMethods = Array.isArray(initialData.allowed_methods) ? initialData.allowed_methods : ['GET']
    const origSort = initialData.default_sort_field || ''

    if (JSON.stringify(origRead.slice().sort()) !== JSON.stringify(selectedReadFields.slice().sort())) return true
    if (JSON.stringify(origWrite.slice().sort()) !== JSON.stringify(selectedWriteFields.slice().sort())) return true
    if (JSON.stringify(origSearch.slice().sort()) !== JSON.stringify(selectedSearchFields.slice().sort())) return true
    if (JSON.stringify(origMethods.slice().sort()) !== JSON.stringify(selectedAllowedMethods.slice().sort())) return true
    if (origSort !== defaultSortField) return true
    return false
  }, [mode, initialData, selectedReadFields, selectedWriteFields, selectedSearchFields, selectedAllowedMethods, defaultSortField])

  const [layerPopoverOpen, setLayerPopoverOpen] = useState(false)

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        const normalized = normalizeMapLayerApiInput(values)
        if (mode === 'create') {
          if (selectedLayer && selectedLayerDisplayFields.length === 0) {
            toast.error(
              'Lớp bản đồ này chưa cấu hình danh sách trường dữ liệu hiển thị. Vui lòng cấu hình trường trong Quản trị lớp bản đồ trước khi tạo API chia sẻ.'
            )
            return
          }
          if (selectedReadFields.length === 0 && !existingRegistryForSelected) {
            toast.error('Vui lòng chọn ít nhất 1 trường dữ liệu cho phép đọc qua API.')
            return
          }

          if (existingRegistryForSelected && !values.consumer?.trim() && !values.name?.trim()) {
            toast.error('Vui lòng nhập tên đơn vị / đối tác sử dụng khóa.')
            return
          }

          const hasWriteMethod = selectedAllowedMethods.some((m) => m !== 'GET')
          if (hasWriteMethod && selectedWriteFields.length === 0 && !existingRegistryForSelected) {
            toast.error('Vui lòng chọn ít nhất 1 trường dữ liệu cho phép ghi (writeFields) khi bật quyền POST/PUT/DELETE.')
            return
          }

          const consumer = (values.consumer?.trim() || values.name?.trim() || '').trim()

          onSubmitCreate({
            ...normalized,
            name: existingRegistryForSelected ? existingRegistryForSelected.name : normalized.name,
            consumer,
            keyName: values.keyName?.trim() || (consumer ? `Khóa ${consumer}` : undefined),
            slug: watchedSlug ? slugify(watchedSlug) : undefined,
            readFields: selectedReadFields.length > 0 ? selectedReadFields : undefined,
            writeFields: hasWriteMethod ? selectedWriteFields : [],
            searchFields: selectedSearchFields,
            allowedMethods: selectedAllowedMethods,
            defaultSortField: defaultSortField || undefined,
            metadata: selectedLayer?.metadata ?? undefined,
            scopes: selectedScopes,
          })
          return
        }

        const hasWriteMethod = selectedAllowedMethods.some((m) => m !== 'GET')
        if (hasWriteMethod && selectedWriteFields.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 trường dữ liệu cho phép ghi (writeFields) khi bật quyền POST/PUT/DELETE.')
          return
        }

        const { layer_id: _layerId, ...patch } = changedPayload as CreateMapLayerApiBody & Record<string, unknown>
        onSubmitUpdate({
          ...patch,
          readFields: selectedReadFields,
          writeFields: hasWriteMethod ? selectedWriteFields : [],
          searchFields: selectedSearchFields,
          allowedMethods: selectedAllowedMethods,
          defaultSortField: defaultSortField || undefined,
        } as Partial<CreateMapLayerApiBody>)
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
              <span className={`truncate text-left min-w-0 ${selectedLayer ? '' : 'text-muted-foreground'}`}>
                {selectedLayer
                  ? `[${selectedLayer.code}] ${layerLabel(selectedLayer)}`
                  : 'Chọn lớp bản đồ'}
              </span>
              <Layers className="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            {/* Input Group có focus đồng bộ */}
            <div className="border-b border-border/60 bg-muted/20 p-2">
              <div
                className="group flex h-9 w-full cursor-text items-center rounded-md border border-input bg-background px-2.5 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search className="mr-2 size-4 shrink-0 text-muted-foreground opacity-60 transition-colors group-focus-within:text-primary group-focus-within:opacity-100" />
                <input
                  ref={searchInputRef}
                  aria-label="Tìm lớp bản đồ"
                  value={layerSearch}
                  onChange={(event) => setLayerSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã lớp..."
                  className="placeholder:text-muted-foreground flex h-full w-full flex-1 border-0 bg-transparent px-0 text-sm shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
                />
                {layerSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa tìm kiếm lớp bản đồ"
                    onClick={(event) => {
                      event.stopPropagation()
                      setLayerSearch('')
                      searchInputRef.current?.focus()
                    }}
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
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
                  const rawFields = layer.metadata?.displayFields ?? layer.metadata?.display_fields
                  const hasConfiguredFields = Array.isArray(rawFields) && rawFields.length > 0
                  const existingReg = existingRegistryMap.get(Number(layer.id))

                  return (
                    <button
                      key={layerId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (layer.id == null) return
                        setChosenLayer(layer)
                        form.setValue('layer_id', Number(layer.id), {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                        setLayerPopoverOpen(false)
                        setLayerSearch('')
                      }}
                      className={`hover:bg-accent flex w-full items-start justify-between rounded-sm px-3 py-2 text-left text-sm ${isSelected ? 'bg-accent' : ''}`}
                    >
                      <span className="flex-1 min-w-0 pr-2">
                        <span className="block font-medium truncate">{layerLabel(layer)}</span>
                        <span className="text-muted-foreground block font-mono text-xs">
                          [{layer.code}] · {layer.geometry_type ?? 'Không rõ kiểu hình học'}
                        </span>
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {existingReg ? (
                          <span className="text-[10px] rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 font-medium">
                            Đã có API
                          </span>
                        ) : hasConfiguredFields ? (
                          <span className="text-[10px] rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-medium">
                            {rawFields.length} trường
                          </span>
                        ) : (
                          <span className="text-[10px] rounded bg-muted text-muted-foreground px-1.5 py-0.5">
                            Chưa có trường
                          </span>
                        )}
                      </div>
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
            : 'Tìm theo tên hoặc mã lớp; mỗi lớp bản đồ được cấp duy nhất 1 API chia sẻ.'}
        </FieldHint>

        {/* Cảnh báo khi chọn lớp đã có API */}
        {existingRegistryForSelected && mode === 'create' && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1.5 break-words">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Lớp bản đồ này đã có API chia sẻ ({existingRegistryForSelected.name})
            </div>
            <p className="text-muted-foreground break-words">
              Endpoint hiện tại:{' '}
              <code className="font-mono text-foreground font-semibold break-all">
                /api/v1/shared/{existingRegistryForSelected.slug}/features
              </code>
            </p>
            <p className="break-words">
              Theo quy định, mỗi lớp bản đồ chỉ có duy nhất 1 API chia sẻ. Khi bạn nhấn nút <strong>"Cấp khóa cho lớp này"</strong> bên dưới, hệ thống sẽ cấp một khóa chia sẻ (API Key) mới cho đối tác mà không tạo trùng API.
            </p>
          </div>
        )}

        {selectedLayer && (
          <div className="space-y-1">
            <FieldHint className="break-words">
              Nhóm: {selectedLayer.category_name ?? selectedLayer.category ?? 'Chưa phân nhóm'} · Kiểu hình học:{' '}
              {selectedLayer.geometry_type ?? 'Chưa xác định'}
            </FieldHint>
            {selectedLayerDisplayFields.length > 0 ? (
              <FieldHint className="text-emerald-600 dark:text-emerald-400 font-medium break-words">
                ✓ Danh sách trường hiển thị của lớp ({selectedLayerDisplayFields.length} trường):{' '}
                <span className="font-mono break-all">{selectedLayerDisplayFields.slice(0, 5).join(', ')}</span>
                {selectedLayerDisplayFields.length > 5 ? ` (+${selectedLayerDisplayFields.length - 5} trường khác)` : ''}
              </FieldHint>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 break-words space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Lớp bản đồ này chưa có danh sách trường thuộc tính hiển thị.
                </div>
                <p className="text-[11px] leading-relaxed break-words">
                  Lớp này chưa có danh sách thuộc tính trong siêu dữ liệu (metadata). Bạn có thể vào mục <strong>Quản lý lớp dữ liệu</strong> &rarr; chọn <strong>Chỉnh sửa</strong> để cấu hình danh sách trường dữ liệu hiển thị cho lớp này, hoặc chọn một lớp bản đồ khác đã có sẵn trường thuộc tính.
                </p>
              </div>
            )}
          </div>
        )}
        <FieldError message={form.formState.errors.layer_id?.message} />
      </div>

      {/* 2. THÔNG TIN API LỚP BẢN ĐỒ (Hiện khi chưa có API cho lớp này hoặc đang edit) */}
      {(!existingRegistryForSelected || mode === 'edit') && (
        <>
          <SectionHeader icon={Settings2} title="Thông tin API lớp bản đồ" />
          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="api-name" className="text-xs font-semibold">
                Tên API lớp bản đồ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="api-name"
                {...form.register('name')}
                placeholder="VD: API Lớp ranh giới đất đai Cẩm Phả"
              />
              <FieldHint>Tên định danh hiển thị của API chia sẻ dữ liệu này.</FieldHint>
              <FieldError message={form.formState.errors.name?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-xs font-semibold">
                Mã định danh API (Slug) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={form.watch('slug') || ''}
                onChange={(e) =>
                  form.setValue('slug', slugify(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="vd: api-duong-ranh-gioi"
                className="font-mono text-sm"
              />
              <FieldHint>
                Endpoint truy vấn:{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-primary font-semibold">
                  /api/v1/shared/{form.watch('slug') || 'slug-api'}/features
                </code>
              </FieldHint>
              <FieldError message={form.formState.errors.slug?.message} />
            </div>
          </div>
        </>
      )}

      {/* 3. CẤU HÌNH PHƯƠNG THỨC & TRƯỜNG DỮ LIỆU API (Chỉ hiện khi chưa có API cho lớp này hoặc đang edit) */}
      {selectedLayer && selectedLayerDisplayFields.length > 0 && !existingRegistryForSelected && (
        <>
          <SectionHeader icon={Settings2} title="Cấu hình phương thức & trường dữ liệu API" />
          <Separator />

          <div className="space-y-4 rounded-lg border bg-muted/15 p-3.5">
            {/* 1. Allowed HTTP Methods (Full CRUD) */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold">Quyền thao tác dữ liệu cho phép (Xem, Thêm, Sửa, Xóa)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Chọn các thao tác mà hệ thống cho phép ứng dụng bên ngoài thực hiện đối với lớp bản đồ này.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-2 text-xs dark:border-blue-900/50 dark:bg-blue-950/20">
                  <Checkbox checked={true} disabled={true} />
                  <div className="leading-tight">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">GET</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">(Xem - Bắt buộc)</span>
                  </div>
                </div>

                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                    selectedAllowedMethods.includes('POST')
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    checked={selectedAllowedMethods.includes('POST')}
                    onCheckedChange={() => handleToggleMethod('POST')}
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">POST</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">(Thêm mới)</span>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                    selectedAllowedMethods.includes('PUT')
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    checked={selectedAllowedMethods.includes('PUT')}
                    onCheckedChange={() => handleToggleMethod('PUT')}
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">PUT</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">(Cập nhật / Sửa)</span>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                    selectedAllowedMethods.includes('DELETE')
                      ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    checked={selectedAllowedMethods.includes('DELETE')}
                    onCheckedChange={() => handleToggleMethod('DELETE')}
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-rose-700 dark:text-rose-400">DELETE</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">(Xóa đối tượng)</span>
                  </div>
                </label>
              </div>
            </div>

            {/* 2. Read Fields */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold">Danh sách cột thông tin cho phép xem (Trường đọc)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Các cột thông tin mà ứng dụng bên ngoài được phép nhìn thấy khi xem dữ liệu bản đồ.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Đã chọn: {selectedReadFields.length}/{selectedLayerDisplayFields.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setSelectedReadFields(selectedLayerDisplayFields)}
                    className="h-6 w-auto px-2 text-[11px]"
                  >
                    Chọn tất cả
                  </Button>
                </div>
              </div>

              {selectedLayerDisplayFields.length > 4 && (
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-2.5 top-2 size-3.5" />
                  <Input
                    type="text"
                    placeholder="Tìm nhanh tên cột đọc..."
                    value={readFieldFilter}
                    onChange={(e) => setReadFieldFilter(e.target.value)}
                    className="h-7.5 bg-background pl-8 pr-7 text-xs"
                  />
                  {readFieldFilter && (
                    <button
                      type="button"
                      onClick={() => setReadFieldFilter('')}
                      className="text-muted-foreground hover:text-foreground absolute right-2 top-2 text-xs"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border bg-background p-2 sm:grid-cols-3">
                {filteredReadFields.length === 0 ? (
                  <p className="col-span-full py-2 text-center text-xs text-muted-foreground italic">
                    Không tìm thấy cột nào khớp với &quot;{readFieldFilter}&quot;
                  </p>
                ) : (
                  filteredReadFields.map((field) => {
                    const isChecked = selectedReadFields.includes(field)
                    return (
                      <label
                        key={field}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded p-1 text-xs min-w-0"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedReadFields((prev) => [...prev, field])
                            } else {
                              if (selectedReadFields.length <= 1) {
                                toast.warn('Cần giữ lại ít nhất 1 trường đọc để có thể hiển thị dữ liệu')
                                return
                              }
                              setSelectedReadFields((prev) => prev.filter((f) => f !== field))
                              setSelectedSearchFields((prev) => prev.filter((f) => f !== field))
                              setSelectedWriteFields((prev) => prev.filter((f) => f !== field))
                            }
                          }}
                        />
                        <span className="font-mono truncate break-all min-w-0" title={field}>{field}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            {/* 3. Write Fields (Khi bật phương thức POST / PUT / DELETE) */}
            {selectedAllowedMethods.some((m) => m !== 'GET') && (
              <div className="space-y-2 rounded-md border border-amber-200/60 bg-amber-50/20 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                      Danh sách cột thông tin cho phép nhập / sửa (Trường ghi) <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Các cột thông tin mà đối tác được phép điền hoặc chỉnh sửa khi gửi dữ liệu lên hệ thống.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      Đã chọn: {selectedWriteFields.length}/{selectedReadFields.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      onClick={() => setSelectedWriteFields([...selectedReadFields])}
                      className="h-6 w-auto px-2 text-[11px]"
                    >
                      Chọn tất cả
                    </Button>
                  </div>
                </div>

                {selectedReadFields.length > 4 && (
                  <div className="relative">
                    <Search className="text-muted-foreground absolute left-2.5 top-2 size-3.5" />
                    <Input
                      type="text"
                      placeholder="Tìm nhanh tên cột ghi..."
                      value={writeFieldFilter}
                      onChange={(e) => setWriteFieldFilter(e.target.value)}
                      className="h-7.5 bg-background pl-8 pr-7 text-xs"
                    />
                    {writeFieldFilter && (
                      <button
                        type="button"
                        onClick={() => setWriteFieldFilter('')}
                        className="text-muted-foreground hover:text-foreground absolute right-2 top-2 text-xs"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border bg-background p-2 sm:grid-cols-3">
                  {filteredWriteFields.length === 0 ? (
                    <p className="col-span-full py-2 text-center text-xs text-muted-foreground italic">
                      Không tìm thấy cột nào khớp với &quot;{writeFieldFilter}&quot;
                    </p>
                  ) : (
                    filteredWriteFields.map((field) => {
                      const isChecked = selectedWriteFields.includes(field)
                      return (
                        <label
                          key={field}
                          className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded p-1 text-xs min-w-0"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedWriteFields((prev) => [...prev, field])
                              } else {
                                if (selectedWriteFields.length <= 1) {
                                  toast.warn('Cần giữ lại ít nhất 1 trường ghi khi đã kích hoạt quyền Thêm/Sửa')
                                  return
                                }
                                setSelectedWriteFields((prev) => prev.filter((f) => f !== field))
                              }
                            }}
                          />
                          <span className="font-mono truncate break-all min-w-0" title={field}>{field}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )}

              {/* 4. Search Fields */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold">Cột thông tin hỗ trợ tìm kiếm nhanh</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Cho phép tìm kiếm nhanh qua tham số <code className="font-mono text-primary font-semibold">?q=từ-khóa</code> theo các cột đã chọn (tối đa 10 cột).
                  </p>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {selectedSearchFields.length}/{availableSearchCandidates.length > 0 ? `${availableSearchCandidates.length} cho phép` : '0 cột'}
                </span>
              </div>

              {selectedLayerAllowedSearchFields.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Lớp bản đồ này chưa cấu hình cột tìm kiếm trong metadata (metadata.searchFields rỗng).</p>
                  <p className="text-[11px]">
                    Theo quy tắc an toàn dữ liệu, hệ thống chỉ cho phép tìm kiếm theo từ khóa trên các cột được cho phép trong cấu hình lớp. API vẫn hỗ trợ đầy đủ việc đọc dữ liệu và lọc theo tọa độ (bbox).
                  </p>
                </div>
              ) : (
                <>
                  {availableSearchCandidates.length > 4 && (
                    <div className="relative">
                      <Search className="text-muted-foreground absolute left-2.5 top-2 size-3.5" />
                      <Input
                        type="text"
                        placeholder="Tìm nhanh cột hỗ trợ tìm kiếm..."
                        value={searchFieldFilter}
                        onChange={(e) => setSearchFieldFilter(e.target.value)}
                        className="h-7.5 bg-background pl-8 pr-7 text-xs"
                      />
                      {searchFieldFilter && (
                        <button
                          type="button"
                          onClick={() => setSearchFieldFilter('')}
                          className="text-muted-foreground hover:text-foreground absolute right-2 top-2 text-xs"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border bg-background p-2 sm:grid-cols-3">
                    {filteredSearchFields.length === 0 ? (
                      <p className="col-span-full py-2 text-center text-xs text-muted-foreground italic">
                        {searchFieldFilter
                          ? `Không tìm thấy cột nào khớp với "${searchFieldFilter}"`
                          : 'Chưa có cột tìm kiếm nào thuộc danh sách trường đọc đã chọn'}
                      </p>
                    ) : (
                      filteredSearchFields.map((field) => {
                        const isChecked = selectedSearchFields.includes(field)
                        return (
                          <label
                            key={field}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded p-1 text-xs min-w-0"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (selectedSearchFields.length >= 10) {
                                    toast.warn('Hệ thống cho phép cấu hình tối đa 10 cột tìm kiếm')
                                    return
                                  }
                                  setSelectedSearchFields((prev) => [...prev, field])
                                } else {
                                  setSelectedSearchFields((prev) => prev.filter((f) => f !== field))
                                }
                              }}
                            />
                            <span className="font-mono truncate break-all min-w-0" title={field}>{field}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 5. Default Sort Field */}
            <div className="space-y-1.5">
              <Label htmlFor="default-sort-field" className="text-xs font-semibold">
                Cột ưu tiên dùng để sắp xếp dữ liệu
              </Label>
              <Select
                value={defaultSortField || selectedReadFields[0] || ''}
                onValueChange={setDefaultSortField}
              >
                <SelectTrigger id="default-sort-field" className="h-9 font-mono text-xs">
                  <SelectValue placeholder="Chọn cột sắp xếp" />
                </SelectTrigger>
                <SelectContent>
                  {selectedReadFields.map((field) => (
                    <SelectItem key={field} value={field} className="font-mono text-xs">
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>Hệ thống sẽ tự động sắp xếp danh sách theo cột này nếu người gọi không yêu cầu riêng.</FieldHint>
            </div>
          </div>
        </>
      )}

      {/* 4. KHÓA CHIA SẺ & ĐỐI TÁC (Chỉ hiện khi mode === 'create') */}
      {mode === 'create' && (
        <>
          <SectionHeader
            icon={KeyRound}
            title={existingRegistryForSelected ? 'Thông tin Khóa truy cập mới' : 'Khóa chia sẻ ban đầu cho đối tác'}
          />
          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="consumer">
                Đơn vị / Đối tác sử dụng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="consumer"
                {...form.register('consumer')}
                placeholder="VD: Sở Tài nguyên và Môi trường, UBND TP Cẩm Phả"
              />
              <FieldHint>Tên cơ quan, tổ chức hoặc đối tác được cấp khóa truy cập dữ liệu.</FieldHint>
              <FieldError message={form.formState.errors.consumer?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyName">Tên khóa gợi nhớ</Label>
              <Input
                id="keyName"
                {...form.register('keyName')}
                placeholder={
                  form.watch('consumer')
                    ? `VD: Khóa ${form.watch('consumer')}`
                    : 'VD: Khóa tra cứu Cổng DVC, Khóa di động'
                }
              />
              <FieldHint>Tên phân biệt mục đích sử dụng (mặc định đặt theo tên đối tác).</FieldHint>
              <FieldError message={form.formState.errors.keyName?.message} />
            </div>
          </div>

          {/* Phân quyền Scopes của Khóa */}
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div>
              <Label className="text-xs font-semibold">Phân quyền cụ thể cho khóa truy cập này</Label>
              <p className="text-[11px] text-muted-foreground">
                Chỉ cấp những quyền cần thiết cho đối tác. Các quyền chưa bật ở mục trên sẽ tự động bị khóa.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50/50 p-2 text-xs dark:border-blue-900/40 dark:bg-blue-950/20">
                <Checkbox checked={true} disabled={true} />
                <div>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">features:read</span>
                  <span className="block text-[10px] text-muted-foreground">Xem dữ liệu (Bắt buộc)</span>
                </div>
              </div>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !selectedAllowedMethods.includes('POST')
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : selectedScopes.includes('features:create')
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={selectedScopes.includes('features:create')}
                  disabled={!selectedAllowedMethods.includes('POST')}
                  onCheckedChange={() => handleToggleScope('features:create')}
                />
                <div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">features:create</span>
                  <span className="block text-[10px] text-muted-foreground">Thêm mới (POST)</span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !selectedAllowedMethods.includes('PUT')
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : selectedScopes.includes('features:update')
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={selectedScopes.includes('features:update')}
                  disabled={!selectedAllowedMethods.includes('PUT')}
                  onCheckedChange={() => handleToggleScope('features:update')}
                />
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">features:update</span>
                  <span className="block text-[10px] text-muted-foreground">Sửa thông tin (PUT)</span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !selectedAllowedMethods.includes('DELETE')
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : selectedScopes.includes('features:delete')
                      ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={selectedScopes.includes('features:delete')}
                  disabled={!selectedAllowedMethods.includes('DELETE')}
                  onCheckedChange={() => handleToggleScope('features:delete')}
                />
                <div>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">features:delete</span>
                  <span className="block text-[10px] text-muted-foreground">Xóa đối tượng (DELETE)</span>
                </div>
              </label>
            </div>
          </div>

          <SectionHeader icon={Gauge} title="Giới hạn truy cập & Thời hạn" />
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
        </>
      )}

      {/* 5. TRẠNG THÁI */}
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

      <div className="bg-muted/50 rounded-md border p-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Mã khóa đầy đủ (JWT Token) chỉ hiển thị một lần duy nhất khi tạo hoặc xoay khóa. Hệ thống chỉ lưu bản băm và tiền tố nhận diện (Token Hint).
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
            disabled={submitting || (mode === 'edit' && Object.keys(changedPayload).length === 0 && !fieldsChangedInEdit)}
            className="min-w-36"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {existingRegistryForSelected && mode === 'create' ? (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Cấp khóa cho lớp này
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {mode === 'create' ? 'Đăng ký API' : 'Cập nhật API'}
                  </>
                )}
              </span>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
