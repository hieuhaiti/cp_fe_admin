import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MAP_LAYER_CATEGORY_OPTIONS,
  getMapLayerCategoryLabel,
  toCategorySlug,
} from '@/constant/mapLayerConstant'

const PREDEFINED_KEYS = new Set(
  MAP_LAYER_CATEGORY_OPTIONS.map((o) => o.value).filter((v) => v !== 'other')
)

export interface CategorySelectProps {
  category: string
  categoryName?: string
  onCategoryChange: (category: string) => void
  onCategoryNameChange?: (categoryName: string) => void
  disabled?: boolean
  label?: string
  required?: boolean
  customCategoryPlaceholder?: string
  className?: string
  id?: string
  error?: string
}

export default function CategorySelect({
  category,
  categoryName,
  onCategoryChange,
  onCategoryNameChange,
  disabled = false,
  label,
  required = false,
  customCategoryPlaceholder,
  className = 'space-y-2',
  id = 'category-select',
  error,
}: CategorySelectProps) {
  const isCustom = category === 'other' || (!PREDEFINED_KEYS.has(category) && Boolean(category))
  const customText = isCustom ? (categoryName || (category === 'other' ? '' : category)) : ''

  const handleSelectChange = (val: string) => {
    if (val === 'other') {
      const currentName = customText.trim()
      const slug = currentName ? toCategorySlug(currentName) : 'other'
      onCategoryChange(slug)
      onCategoryNameChange?.(currentName || 'Khác')
    } else {
      onCategoryChange(val)
      onCategoryNameChange?.(getMapLayerCategoryLabel(val))
    }
  }

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onCategoryNameChange?.(val)
    const slug = toCategorySlug(val)
    onCategoryChange(slug || 'other')
  }

  const selectValue = isCustom ? 'other' : (category || undefined)

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Chọn nhóm lớp" />
        </SelectTrigger>
        <SelectContent>
          {MAP_LAYER_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={`${id}-custom-name`} className="text-xs text-muted-foreground">
            Tên danh mục mới <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${id}-custom-name`}
            placeholder={customCategoryPlaceholder || 'Nhập tên danh mục (VD: Ngập ven biển)'}
            value={customText}
            maxLength={120}
            disabled={disabled}
            onChange={handleCustomTextChange}
          />

        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
