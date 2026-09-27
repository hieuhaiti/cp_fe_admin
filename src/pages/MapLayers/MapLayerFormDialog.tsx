import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Plus, Trash2, ListChecks, FileCode, ListFilter, Search, X, Database, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mapLayerService, useApiQuery } from '@/service'
import type {
  ApiResponse,
  CreateMapLayerBody,
  GeometryType,
  MapLayer,
  MapLayerDefaultStyle,
  MapLayerLegend,
  MapLayerLegendEntry,
} from '@/types/api'
import { toast } from 'react-toastify'
import CategorySelect from '@/components/common/CategorySelect'
import { getMapLayerCategoryLabel } from '@/constant/mapLayerConstant'
import {
  cleanStyleObject,
  getStyleDefinitions,
  parseStyleJson,
  stringifyStyle,
} from './mapLayerStyle'

interface MapLayerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layerCode: string | null
  onSubmit: (data: CreateMapLayerBody) => void
  isLoading?: boolean
}

type MapLayerDetailData = MapLayer | { mapLayer?: MapLayer }

export const mapLayerSchema = z.object({
  category: z.string().trim().min(1, { message: 'Vui lòng chọn nhóm lớp' }).max(60),
  category_name: z
    .string({ message: 'Tên danh mục là bắt buộc' })
    .trim()
    .min(2, { message: 'Tên danh mục phải có ít nhất 2 ký tự' })
    .max(120),
  name: z
    .string({ message: 'Tên lớp bản đồ là bắt buộc' })
    .trim()
    .min(2, { message: 'Tên lớp bản đồ phải có ít nhất 2 ký tự' })
    .max(200, { message: 'Tên lớp bản đồ không được vượt quá 200 ký tự' }),
  geometry_type: z.enum(['polygon', 'line', 'point', 'raster'], {
    message: 'Vui lòng chọn kiểu hình học.',
  }),
  properties: z.record(z.string(), z.any()).nullable().optional(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
  is_enable_default: z.boolean().optional(),
})

function stringifyJson(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
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

type FormGeometryKind = 'point' | 'line' | 'polygon' | 'raster'

function toApiGeometryType(type: FormGeometryKind): CreateMapLayerBody['geometry_type'] {
  if (type === 'point') return 'POINT'
  if (type === 'line') return 'LINESTRING'
  if (type === 'polygon') return 'POLYGON'
  if (type === 'raster') return 'RASTER'
  return type
}

function toFormGeometryType(type?: GeometryType | null): FormGeometryKind {
  const upper = String(type || '').toUpperCase()
  if (upper === 'POINT' || upper === 'MULTIPOINT') return 'point'
  if (upper === 'LINESTRING' || upper === 'MULTILINESTRING') return 'line'
  if (upper === 'RASTER') return 'raster'
  return 'polygon'
}

// ── Legend (chú giải bản đồ): label + color pairs ───────────────────────────

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const DEFAULT_LEGEND_COLORS = [
  '#1A73E8',
  '#2D7B2E',
  '#F4B400',
  '#DB4437',
  '#8E44AD',
  '#00ACC1',
]

function nextDefaultLegendColor(index: number): string {
  return DEFAULT_LEGEND_COLORS[index % DEFAULT_LEGEND_COLORS.length]
}

function legendEntriesFromConfig(legend: unknown): MapLayerLegendEntry[] {
  if (!legend || typeof legend !== 'object') return []
  const entries = (legend as MapLayerLegend).entries
  if (!Array.isArray(entries)) return []
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      label: typeof entry.label === 'string' ? entry.label : '',
      color: typeof entry.color === 'string' ? entry.color : '',
    }))
}

function stringifyLegendEntries(entries: MapLayerLegendEntry[]): string {
  const cleaned = entries.filter((entry) => entry.label.trim() || entry.color.trim())
  if (!cleaned.length) return ''
  return JSON.stringify({ entries: cleaned }, null, 2)
}

interface LegendEditorProps {
  entries: MapLayerLegendEntry[]
  onEntriesChange: (entries: MapLayerLegendEntry[]) => void
  onJsonValidityChange?: (isValid: boolean) => void
}

// Cho phép người dùng điền chú giải qua danh sách cặp tên/màu (mặc định) hoặc
// dán trực tiếp JSON thô `{"entries":[{"label":"...","color":"#..."}]}`.
// Hai chế độ đồng bộ 2 chiều thông qua `entries` (nguồn dữ liệu chuẩn duy nhất).
function LegendEditor({ entries, onEntriesChange, onJsonValidityChange }: LegendEditorProps) {
  const [mode, setMode] = useState<'ui' | 'json'>('ui')
  const [jsonText, setJsonText] = useState<string>(() => stringifyLegendEntries(entries))
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'json') {
      // This effect synchronizes the editable JSON buffer with the canonical entries prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonText(stringifyLegendEntries(entries))
      setJsonError(null)
      onJsonValidityChange?.(true)
    }
  }, [entries, mode, onJsonValidityChange])



  function handleSwitchToJson() {
    setJsonText(stringifyLegendEntries(entries))
    setJsonError(null)
    onJsonValidityChange?.(true)
    setMode('json')
  }

  function handleSwitchToUi() {
    if (jsonText.trim()) {
      try {
        const parsed = JSON.parse(jsonText.trim())
        const parsedEntries = legendEntriesFromConfig(parsed)
        onEntriesChange(parsedEntries)
        setJsonError(null)
        onJsonValidityChange?.(true)
      } catch {
        onJsonValidityChange?.(false)
        toast.error('JSON chú giải không hợp lệ, vui lòng kiểm tra lại trước khi chuyển chế độ')
        return
      }
    } else {
      onEntriesChange([])
      onJsonValidityChange?.(true)
    }
    setMode('ui')
  }

  function handleAddRow() {
    onEntriesChange([...entries, { label: '', color: nextDefaultLegendColor(entries.length) }])
  }

  function handleRemoveRow(index: number) {
    onEntriesChange(entries.filter((_, i) => i !== index))
  }

  function handleEntryChange(index: number, patch: Partial<MapLayerLegendEntry>) {
    onEntriesChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  }

  function handleJsonTextChange(value: string) {
    setJsonText(value)
    if (!value.trim()) {
      setJsonError(null)
      onEntriesChange([])
      onJsonValidityChange?.(true)
      return
    }
    try {
      const parsed = JSON.parse(value.trim())
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as MapLayerLegend).entries)) {
        // JSON mode edits must update the same canonical state used by submit.
        onEntriesChange(legendEntriesFromConfig(parsed))
        setJsonError(null)
        onJsonValidityChange?.(true)
      } else {
        onJsonValidityChange?.(false)
        setJsonError('JSON phải có dạng { "entries": [ { "label", "color" } ] }')
      }
    } catch {
      onJsonValidityChange?.(false)
      setJsonError('JSON không hợp lệ')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Chú giải bản đồ (tùy chọn)</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === 'ui' ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSwitchToUi}
          >
            <ListChecks className="size-4" aria-hidden="true" />
            Danh sách
          </Button>
          <Button
            type="button"
            variant={mode === 'json' ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSwitchToJson}
          >
            <FileCode className="size-4" aria-hidden="true" />
            JSON
          </Button>
        </div>
      </div>

      {mode === 'ui' ? (
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              Chưa có mục chú giải nào. Nhấn "Thêm mục" để định nghĩa tên và màu hiển thị.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const colorValid = HEX_COLOR_PATTERN.test(entry.color.trim())
                return (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Màu chú giải ${index + 1}`}
                      value={colorValid ? entry.color : '#94a3b8'}
                      onChange={(e) => handleEntryChange(index, { color: e.target.value })}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
                    />
                    <Input
                      value={entry.color}
                      onChange={(e) => handleEntryChange(index, { color: e.target.value })}
                      placeholder="#1A73E8"
                      className={`w-28 font-mono text-xs ${!colorValid && entry.color ? 'border-destructive' : ''}`}
                    />
                    <Input
                      value={entry.label}
                      onChange={(e) => handleEntryChange(index, { label: e.target.value })}
                      placeholder="Tên chú giải, ví dụ: Mặt nước"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                      aria-label="Xóa mục chú giải"
                    >
                      <Trash2 className="text-destructive size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="size-4" aria-hidden="true" />
            Thêm mục chú giải
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Textarea
            id="legend-config-json"
            rows={6}
            value={jsonText}
            onChange={(e) => handleJsonTextChange(e.target.value)}
            placeholder='{"entries":[{"label":"Mặt nước","color":"#1A73E8"},{"label":"Rừng","color":"#2D7B2E"}]}'
            className="font-mono text-xs"
          />
          {jsonError ? <p className="text-destructive text-xs">{jsonError}</p> : null}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Mỗi mục gồm <code className="bg-muted rounded px-1">label</code> (tên hiển thị) và{' '}
        <code className="bg-muted rounded px-1">color</code> (mã màu hex). Để trống toàn bộ để
        không hiển thị chú giải cho lớp này.
      </p>
    </div>
  )
}

// ── Style Editor (kiểu vẽ và màu sắc lớp): two-mode UI + JSON ──────────────

interface StyleEditorProps {
  geometryType: FormGeometryKind | GeometryType | string
  style: MapLayerDefaultStyle | null
  onStyleChange: (style: MapLayerDefaultStyle | null) => void
  onJsonValidityChange?: (isValid: boolean) => void
}

function StyleEditor({
  geometryType,
  style,
  onStyleChange,
  onJsonValidityChange,
}: StyleEditorProps) {
  const [mode, setMode] = useState<'ui' | 'json'>('ui')
  const [jsonText, setJsonText] = useState<string>(() => stringifyStyle(style))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [selectedKeyToAdd, setSelectedKeyToAdd] = useState<string>('')

  const availableDefinitions = getStyleDefinitions(geometryType)

  useEffect(() => {
    if (mode !== 'json') {
      // Synchronize the editable JSON buffer with the canonical style prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonText(stringifyStyle(style))
      setJsonError(null)
      onJsonValidityChange?.(true)
    }
  }, [style, mode, onJsonValidityChange])



  function handleSwitchToJson() {
    setJsonText(stringifyStyle(style))
    setJsonError(null)
    onJsonValidityChange?.(true)
    setMode('json')
  }

  function handleSwitchToUi() {
    if (jsonText.trim()) {
      const { style: parsed, error } = parseStyleJson(jsonText)
      if (error) {
        onJsonValidityChange?.(false)
        toast.error('JSON kiểu vẽ không hợp lệ, vui lòng kiểm tra lại trước khi chuyển chế độ')
        return
      }
      onStyleChange(parsed)
      setJsonError(null)
      onJsonValidityChange?.(true)
    } else {
      onStyleChange(null)
      onJsonValidityChange?.(true)
    }
    setMode('ui')
  }

  function handleJsonTextChange(value: string) {
    setJsonText(value)
    if (!value.trim()) {
      setJsonError(null)
      onStyleChange(null)
      onJsonValidityChange?.(true)
      return
    }
    const { style: parsed, error } = parseStyleJson(value)
    if (error) {
      setJsonError(error)
      onJsonValidityChange?.(false)
    } else {
      setJsonError(null)
      onStyleChange(parsed)
      onJsonValidityChange?.(true)
    }
  }

  function handleAddProperty(key: string) {
    if (!key) return
    const current = style ? { ...style } : {}
    if (key in current) return
    const def = availableDefinitions.find((d) => d.key === key)
    let initialValue: unknown = ''
    if (def?.type === 'color') initialValue = def.placeholder || '#3388FF'
    else if (def?.type === 'number') initialValue = def.min !== undefined ? def.min : 0
    else if (def?.type === 'boolean') initialValue = true
    else if (def?.type === 'select') initialValue = def.options?.[0]?.value || ''
    else if (def?.type === 'dasharray') initialValue = [2, 4]

    current[key] = initialValue
    onStyleChange(current as MapLayerDefaultStyle)
    setSelectedKeyToAdd('')
  }

  function handleRemoveProperty(key: string) {
    if (!style) return
    const current = { ...style }
    delete current[key]
    onStyleChange(Object.keys(current).length > 0 ? (current as MapLayerDefaultStyle) : null)
  }

  function handlePropertyChange(key: string, value: unknown) {
    const current = style ? { ...style } : {}
    current[key] = value
    onStyleChange(current as MapLayerDefaultStyle)
  }

  const currentKeys = Object.keys(style || {})
  const unselectedDefinitions = availableDefinitions.filter((def) => !currentKeys.includes(def.key))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Kiểu vẽ & Màu sắc lớp (defaultStyle, tùy chọn)</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === 'ui' ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSwitchToUi}
          >
            <ListChecks className="size-4" aria-hidden="true" />
            Danh sách
          </Button>
          <Button
            type="button"
            variant={mode === 'json' ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSwitchToJson}
          >
            <FileCode className="size-4" aria-hidden="true" />
            JSON
          </Button>
        </div>
      </div>

      {mode === 'ui' ? (
        <div className="space-y-3">
          {currentKeys.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              Chưa có thuộc tính kiểu vẽ nào. Chọn thuộc tính từ danh sách bên dưới để cấu hình màu sắc, độ mờ hoặc độ dày.
            </p>
          ) : (
            <div className="space-y-2">
              {currentKeys.map((key) => {
                const def = availableDefinitions.find((d) => d.key === key) || {
                  key,
                  label: key,
                  type: 'number' as const,
                }
                const val = style?.[key]

                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
                    <div className="w-48 shrink-0">
                      <span className="font-medium text-foreground block truncate" title={def.label}>
                        {def.label}
                      </span>
                      {def.description && (
                        <span className="text-muted-foreground block text-[10px] truncate" title={def.description}>
                          {def.description}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      {def.type === 'color' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={def.label}
                            value={HEX_COLOR_PATTERN.test(String(val || '')) ? String(val) : '#3388FF'}
                            onChange={(e) => handlePropertyChange(key, e.target.value)}
                            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input p-0.5"
                          />
                          <Input
                            value={String(val ?? '')}
                            onChange={(e) => handlePropertyChange(key, e.target.value)}
                            placeholder={def.placeholder || '#3388FF'}
                            className="font-mono text-xs h-8"
                          />
                        </div>
                      ) : def.type === 'number' ? (
                        <Input
                          type="number"
                          min={def.min}
                          max={def.max}
                          step={def.step ?? 'any'}
                          value={val !== undefined && val !== null ? String(val) : ''}
                          onChange={(e) =>
                            handlePropertyChange(
                              key,
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          placeholder={def.placeholder || '0'}
                          className="text-xs h-8"
                        />
                      ) : def.type === 'select' ? (
                        <Select
                          value={String(val || def.options?.[0]?.value || '')}
                          onValueChange={(v) => handlePropertyChange(key, v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {def.options?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : def.type === 'boolean' ? (
                        <div className="flex items-center gap-2 h-8">
                          <Checkbox
                            id={`style-prop-${key}`}
                            checked={Boolean(val)}
                            onCheckedChange={(checked) => handlePropertyChange(key, checked === true)}
                          />
                          <label htmlFor={`style-prop-${key}`} className="text-xs cursor-pointer">
                            {val ? 'Bật (true)' : 'Tắt (false)'}
                          </label>
                        </div>
                      ) : def.type === 'dasharray' ? (
                        <Input
                          value={Array.isArray(val) ? val.join(', ') : String(val ?? '')}
                          onChange={(e) => {
                            const raw = e.target.value
                            const parsedArray = raw
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map(Number)
                              .filter((n) => !isNaN(n))
                            handlePropertyChange(key, parsedArray.length ? parsedArray : undefined)
                          }}
                          placeholder={def.placeholder || '2, 4'}
                          className="font-mono text-xs h-8"
                        />
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProperty(key)}
                      aria-label={`Xóa thuộc tính ${def.label}`}
                      className="h-8 w-8 shrink-0"
                    >
                      <Trash2 className="text-destructive size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {unselectedDefinitions.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedKeyToAdd} onValueChange={setSelectedKeyToAdd}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="-- Chọn thuộc tính để thêm --" />
                </SelectTrigger>
                <SelectContent>
                  {unselectedDefinitions.map((def) => (
                    <SelectItem key={def.key} value={def.key} className="text-xs">
                      {def.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!selectedKeyToAdd}
                onClick={() => handleAddProperty(selectedKeyToAdd)}
              >
                <Plus className="size-4 mr-1" aria-hidden="true" />
                Thêm
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <Textarea
            id="style-config-json"
            rows={6}
            value={jsonText}
            onChange={(e) => handleJsonTextChange(e.target.value)}
            placeholder='{\n  "fillColor": "#3388FF",\n  "fillOpacity": 0.6,\n  "strokeColor": "#0055AA",\n  "strokeWidth": 2\n}'
            className="font-mono text-xs"
          />
          {jsonError ? <p className="text-destructive text-xs">{jsonError}</p> : null}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Cấu hình màu sắc, độ rộng viền và độ trong suốt hiển thị trên bản đồ. Để trống toàn bộ nếu muốn dùng màu mặc định của hệ thống.
      </p>
    </div>
  )
}

// ── DisplayFields & SearchFields (Trường thuộc tính hiển thị & tìm kiếm) ──────

interface DisplayFieldsEditorProps {
  displayFields: string[]
  searchFields: string[]
  availableColumns: string[]
  loadingColumns: boolean
  onDisplayFieldsChange: (fields: string[]) => void
  onSearchFieldsChange: (fields: string[]) => void
}

function DisplayFieldsEditor({
  displayFields,
  searchFields,
  availableColumns,
  loadingColumns,
  onDisplayFieldsChange,
  onSearchFieldsChange,
}: DisplayFieldsEditorProps) {
  const [fieldInput, setFieldInput] = useState('')

  function handleAddField(rawInput?: string) {
    const text = (rawInput ?? fieldInput).trim()
    if (!text) return

    // Hỗ trợ nhập 1 trường hoặc dán chuỗi phân tách bởi dấu phẩy, chấm phẩy, khoảng trắng
    const candidateFields = text
      .split(/[,;\s]+/)
      .map((f) => f.trim().toLowerCase())
      .filter((f) => f && /^[a-z0-9_]+$/.test(f))

    if (candidateFields.length === 0) {
      toast.warn('Tên trường chỉ được chứa chữ cái thường (a-z), chữ số (0-9) và dấu gạch dưới (_)')
      return
    }

    const currentSet = new Set(displayFields)
    const added: string[] = []
    for (const f of candidateFields) {
      if (!currentSet.has(f)) {
        currentSet.add(f)
        added.push(f)
      }
    }

    if (added.length === 0) {
      toast.info('Các trường này đã có trong danh sách hiển thị')
    } else {
      onDisplayFieldsChange(Array.from(currentSet))
      if (!rawInput) setFieldInput('')
    }
  }

  function handleRemoveField(fieldToRemove: string) {
    onDisplayFieldsChange(displayFields.filter((f) => f !== fieldToRemove))
    onSearchFieldsChange(searchFields.filter((f) => f !== fieldToRemove))
  }

  function handleToggleSearchField(field: string) {
    if (searchFields.includes(field)) {
      onSearchFieldsChange(searchFields.filter((f) => f !== field))
    } else {
      if (searchFields.length >= 10) {
        toast.warn('Hệ thống chỉ cho phép tối đa 10 trường tìm kiếm')
        return
      }
      onSearchFieldsChange([...searchFields, field])
    }
  }

  function handleAddAllAvailable() {
    const currentSet = new Set(displayFields)
    for (const col of availableColumns) {
      currentSet.add(col)
    }
    onDisplayFieldsChange(Array.from(currentSet))
  }

  function handleClearAll() {
    onDisplayFieldsChange([])
    onSearchFieldsChange([])
  }

  const unaddedColumns = availableColumns.filter((col) => !displayFields.includes(col))

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ListFilter className="size-3.5 text-primary" />
            Cấu hình trường dữ liệu hiển thị
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Các cột thông tin hiển thị trên bảng thuộc tính WebGIS và chia sẻ qua API dữ liệu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {displayFields.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{displayFields.length} trường hiển thị</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/20 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              <span>0 trường hiển thị</span>
            </div>
          )}
          {displayFields.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="h-7 gap-1.5 border-destructive/30 bg-destructive/5 px-2.5 text-xs font-medium text-destructive transition-all hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="Bỏ chọn toàn bộ trường hiển thị"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa tất cả</span>
            </Button>
          )}
        </div>
      </div>

      {/* Input thêm trường mới */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={fieldInput}
            onChange={(e) => setFieldInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddField()
              }
            }}
            placeholder="Nhập tên cột hoặc dán danh sách ngăn cách bởi dấu phẩy (vd: ten_xa, ma_xa, dien_tich)..."
            className="h-8 font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddField()}
          disabled={!fieldInput.trim()}
          className="h-8 shrink-0 text-xs gap-1"
        >
          <Plus className="size-3.5" />
          <span>Thêm trường</span>
        </Button>
      </div>

      {/* Gợi ý cột từ bảng dữ liệu PostGIS nếu có */}
      {loadingColumns && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground p-1">
          <Database className="size-3 animate-pulse text-primary" />
          <span>Đang tải danh sách cột từ cơ sở dữ liệu...</span>
        </div>
      )}
      {!loadingColumns && availableColumns.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-dashed border-border/70 bg-background/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Database className="size-3 text-primary" />
              Cột có trong bảng dữ liệu ({availableColumns.length} cột):
            </span>
            {unaddedColumns.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleAddAllAvailable}
                className="h-5 px-1 text-[10px] text-primary hover:underline"
              >
                + Thêm tất cả ({unaddedColumns.length})
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-1">
            {availableColumns.map((col) => {
              const isAdded = displayFields.includes(col)
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    if (isAdded) {
                      handleRemoveField(col)
                    } else {
                      handleAddField(col)
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                    isAdded
                      ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                      : 'border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  title={isAdded ? `Nhấn để bỏ cột "${col}"` : `Nhấn để thêm cột "${col}" vào danh sách`}
                >
                  {isAdded ? <Check className="size-3" /> : <Plus className="size-3 opacity-60" />}
                  <span className="break-all">{col}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Danh sách các trường hiển thị đã chọn */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Danh sách trường được chọn ({displayFields.length}):</span>
          <span className="text-[10px] italic">Bật icon kính lúp để cho phép tìm kiếm nhanh qua tham số ?q=</span>
        </div>

        {displayFields.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium">Chưa có trường hiển thị nào được chọn.</p>
            <p className="text-[11px] mt-0.5">
              Vui lòng nhập tên trường hoặc click chọn từ cột trong bảng dữ liệu ở trên để kích hoạt hiển thị thuộc tính và chia sẻ API.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-md border bg-background p-2">
            {displayFields.map((field) => {
              const isSearchable = searchFields.includes(field)
              return (
                <div
                  key={field}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs shadow-xs transition-colors ${
                    isSearchable
                      ? 'border-blue-300 bg-blue-50/80 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                      : 'border-border/80 bg-background text-foreground'
                  }`}
                >
                  <span className="font-mono font-medium text-xs break-all">{field}</span>
                  {isSearchable && (
                    <span className="text-[10px] bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 rounded px-1 py-0.5 font-sans font-medium">
                      Tìm kiếm
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleSearchField(field)}
                    className={`rounded p-0.5 transition-colors ${
                      isSearchable ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-200/50' : 'text-muted-foreground/60 hover:text-primary hover:bg-accent'
                    }`}
                    title={isSearchable ? 'Đang bật tìm kiếm nhanh (click để tắt)' : 'Bật tìm kiếm nhanh cho trường này'}
                  >
                    <Search className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field)}
                    className="rounded p-0.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title={`Xóa trường "${field}"`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MapLayerFormDialog({
  open,
  onOpenChange,
  layerCode,
  onSubmit,
  isLoading = false,
}: MapLayerFormDialogProps) {
  const [category, setCategory] = useState<string>('forest_district')
  const [categoryName, setCategoryName] = useState<string>('Phân loại đối tượng theo huyện')
  const [layerKind, setLayerKind] = useState<'basemap' | 'overlay'>('overlay')
  const [name, setName] = useState<string>('')
  const [geometryType, setGeometryType] = useState<FormGeometryKind>('polygon')
  const [isPublic, setIsPublic] = useState<'true' | 'false'>('false')
  const [isEnableDefault, setIsEnableDefault] = useState(false)
  const [propertiesText, setPropertiesText] = useState<string>('')
  const [legendEntries, setLegendEntries] = useState<MapLayerLegendEntry[]>([])
  const [legendJsonInvalid, setLegendJsonInvalid] = useState(false)
  const [defaultStyle, setDefaultStyle] = useState<MapLayerDefaultStyle | null>(null)
  const [styleJsonInvalid, setStyleJsonInvalid] = useState(false)
  const [displayFields, setDisplayFields] = useState<string[]>([])
  const [searchFields, setSearchFields] = useState<string[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [loadingColumns, setLoadingColumns] = useState(false)

  const layerQuery = useApiQuery(
    ['mapLayer', layerCode],
    () => mapLayerService.getByCode(layerCode!),
    { enabled: !!layerCode && open, staleTime: 0 },
    false,
    false
  )

  const responseData = (layerQuery.data as ApiResponse<MapLayerDetailData>)?.data
  const layer =
    (responseData && 'mapLayer' in responseData
      ? (responseData as { mapLayer?: MapLayer }).mapLayer
      : (responseData as MapLayer)) ?? null
  const isEdit = !!layerCode

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      // Reset local editor state when opening the create dialog.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategory('forest_district')
      setCategoryName('Phân loại đối tượng theo huyện')
      setLayerKind('overlay')
      setName('')
      setGeometryType('polygon')
      setIsPublic('false')
      setIsEnableDefault(false)
      setPropertiesText('')
      setLegendEntries([])
      setLegendJsonInvalid(false)
      setDefaultStyle(null)
      setStyleJsonInvalid(false)
      setDisplayFields([])
      setSearchFields([])
      setAvailableColumns([])
      return
    }

    if (layer) {
      setCategory(layer.category || '')
      setCategoryName(
        layer.category_name || getMapLayerCategoryLabel(layer.category)
      )
      setLayerKind(layer.layer_kind === 'basemap' ? 'basemap' : 'overlay')
      setName(layer.name_vi || layer.name || '')
      setGeometryType(toFormGeometryType(layer.geometry_type))
      setIsPublic(layer.is_public ? 'true' : 'false')
      setIsEnableDefault(Boolean(layer.is_enable_default))
      setPropertiesText(stringifyJson(layer.properties))
      setLegendEntries(legendEntriesFromConfig(layer.legend_config))
      setLegendJsonInvalid(false)
      const initialStyle = layer.metadata?.defaultStyle ?? layer.default_style ?? null
      setDefaultStyle(initialStyle)
      setStyleJsonInvalid(false)

      const initialDisplay = Array.isArray(layer.metadata?.displayFields)
        ? (layer.metadata.displayFields as string[])
        : []
      const initialSearch = Array.isArray(layer.metadata?.searchFields)
        ? (layer.metadata.searchFields as string[])
        : []
      setDisplayFields(initialDisplay)
      setSearchFields(initialSearch)

      if (layer.id != null) {
        setLoadingColumns(true)
        mapLayerService
          .getFields(layer.id)
          .then((res) => {
            const data = (res as any)?.data ?? res
            const cols = data?.availableColumns
            if (Array.isArray(cols)) {
              setAvailableColumns(cols)
            }
          })
          .catch(() => {
            const fallbackCols = new Set<string>()
            if (Array.isArray(layer.metadata?.displayFields)) {
              layer.metadata.displayFields.forEach((f) => typeof f === 'string' && fallbackCols.add(f))
            }
            if (layer.properties && typeof layer.properties === 'object') {
              Object.keys(layer.properties)
                .filter((k) => k !== 'geom')
                .forEach((k) => fallbackCols.add(k))
            }
            if (fallbackCols.size > 0) {
              setAvailableColumns(Array.from(fallbackCols))
            }
          })
          .finally(() => setLoadingColumns(false))
      }
    }
  }, [open, isEdit, layer])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (legendJsonInvalid) {
      toast.error('JSON chú giải không hợp lệ, vui lòng kiểm tra lại trước khi lưu')
      return
    }

    if (styleJsonInvalid) {
      toast.error('JSON kiểu vẽ không hợp lệ, vui lòng kiểm tra lại trước khi lưu')
      return
    }

    let properties: Record<string, unknown> | undefined
    if (propertiesText.trim()) {
      try {
        const parsed: unknown = JSON.parse(propertiesText.trim())
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          properties = parsed as Record<string, unknown>
        } else {
          toast.error('Properties phải là JSON object hợp lệ')
          return
        }
      } catch {
        toast.error('Properties phải là JSON hợp lệ')
        return
      }
    }

    const trimmedLegendEntries = legendEntries
      .map((entry) => ({ label: entry.label.trim(), color: entry.color.trim() }))
      .filter((entry) => entry.label || entry.color)
    for (const entry of trimmedLegendEntries) {
      if (!entry.label) {
        toast.error('Mỗi mục chú giải cần có tên hiển thị')
        return
      }
      if (!HEX_COLOR_PATTERN.test(entry.color)) {
        toast.error(`Màu chú giải "${entry.label}" không hợp lệ (cần dạng #RRGGBB)`)
        return
      }
    }
    const legendConfig: MapLayerLegend | null = trimmedLegendEntries.length
      ? { entries: trimmedLegendEntries }
      : null

    const fullValidation = mapLayerSchema.safeParse({
      category,
      category_name: categoryName.trim(),
      name: name.trim(),
      geometry_type: geometryType,
      properties: properties ?? null,
      is_public: isPublic === 'true',
      is_enable_default: isEnableDefault,
    })
    if (!fullValidation.success) {
      const first = fullValidation.error.issues[0]
      toast.error(first?.message || 'Dữ liệu không hợp lệ')
      return
    }

    const code = isEdit && layer?.code ? layer.code : toLayerCode(name.trim())
    const expectedUpdatedAt = isEdit ? (layer?.updatedAt ?? layer?.updated_at ?? undefined) : undefined
    const cleanedStyle = cleanStyleObject(defaultStyle)
    const cleanedDisplayFields = Array.from(
      new Set(displayFields.map((f) => f.trim().toLowerCase()).filter(Boolean))
    )
    const cleanedSearchFields = Array.from(
      new Set(
        searchFields
          .map((f) => f.trim().toLowerCase())
          .filter((f) => cleanedDisplayFields.includes(f))
      )
    )

    const payload: CreateMapLayerBody = {
      code,
      name_vi: name.trim(),
      table_name: isEdit && layer?.table_name ? layer.table_name : code,
      schema_name: isEdit ? layer?.schema_name || 'gis' : 'gis',
      category,
      category_name: categoryName.trim(),
      layer_kind: layerKind,
      geometry_type: toApiGeometryType(geometryType),
      epsg_code: 4326,
      is_public: isPublic === 'true',
      is_enable_default: isEnableDefault,
      is_editable: true,
      legend_config: legendConfig,
      metadata: {
        defaultStyle: cleanedStyle ?? null,
        ...(cleanedDisplayFields.length > 0 || (isEdit && Array.isArray(layer?.metadata?.displayFields))
          ? { displayFields: cleanedDisplayFields }
          : {}),
        ...(cleanedSearchFields.length > 0 || (isEdit && Array.isArray(layer?.metadata?.searchFields))
          ? { searchFields: cleanedSearchFields }
          : {}),
      },
      ...(properties ? { properties } : {}),
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    }
    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{isEdit ? 'Chỉnh sửa lớp dữ liệu' : 'Thêm lớp dữ liệu mới'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Cập nhật thông tin lớp dữ liệu bản đồ'
            : 'Tạo lớp dữ liệu theo nhóm nghiệp vụ và kiểu hình học'}
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <CategorySelect
            category={category}
            categoryName={categoryName}
            onCategoryChange={setCategory}
            onCategoryNameChange={setCategoryName}
            label="Nhóm lớp"
            required
          />

          <div className="space-y-2">
            <Label htmlFor="map-layer-name">Tên lớp dữ liệu *</Label>
            <Input
              id="map-layer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Ranh giới phường xã Cẩm Phả"
              required
            />
          </div>

       
          <div className="space-y-2">
            <Label>Phạm vi hiển thị</Label>
            <Select value={isPublic} onValueChange={(v) => setIsPublic(v as 'true' | 'false')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Nội bộ</SelectItem>
                <SelectItem value="true">Công khai trên WebGIS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="map-layer-default-enabled"
              className="border-border flex cursor-pointer items-center gap-3 rounded-md border p-3"
            >
              <Checkbox
                id="map-layer-default-enabled"
                checked={isEnableDefault}
                onCheckedChange={(checked) => setIsEnableDefault(checked === true)}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Bật mặc định trên WebGIS</span>
                <span className="text-muted-foreground block text-xs">
                  Lớp sẽ tự hiển thị khi người dùng mở bản đồ.
                </span>
              </span>
            </label>
          </div>

          <LegendEditor
            entries={legendEntries}
            onEntriesChange={setLegendEntries}
            onJsonValidityChange={(isValid) => setLegendJsonInvalid(!isValid)}
          />

          <StyleEditor
            geometryType={geometryType}
            style={defaultStyle}
            onStyleChange={setDefaultStyle}
            onJsonValidityChange={(isValid) => setStyleJsonInvalid(!isValid)}
          />

          <DisplayFieldsEditor
            displayFields={displayFields}
            searchFields={searchFields}
            availableColumns={availableColumns}
            loadingColumns={loadingColumns}
            onDisplayFieldsChange={setDisplayFields}
            onSearchFieldsChange={setSearchFields}
          />



          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
