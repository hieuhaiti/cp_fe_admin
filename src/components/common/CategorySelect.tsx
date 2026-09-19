import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Plus, Loader2, X, Search, ChevronDown, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getMapLayerCategoryLabel } from '@/constant/mapLayerConstant'
import { useLayerCategories } from '@/hooks/useLayerCategories'
import { toast } from 'react-toastify'

const CREATE_NEW_OPTION_VALUE = '__create_new__'

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

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
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const {
    categories,
    isLoading,
    isError,
    error: categoriesError,
    refetch,
    createCategory,
    isCreating,
  } = useLayerCategories(debouncedSearch ? { search: debouncedSearch } : undefined)

  const [isAddingNew, setIsAddingNew] = useState(() => category === 'other')
  const [newCategoryName, setNewCategoryName] = useState(() =>
    category === 'other' ? categoryName || '' : ''
  )
  const [localError, setLocalError] = useState<string | null>(null)

  // Lấy danh mục hoàn toàn động từ server + giữ lại danh mục hiện tại nếu layer đã lưu
  const options = useMemo(() => {
    const map = new Map<string, string>()

    if (categories && categories.length > 0) {
      categories.forEach((cat) => {
        if (cat.key && cat.name) {
          map.set(cat.key, cat.name)
        }
      })
    }

    // Nếu layer hiện hành có category không nằm trong danh sách chuẩn, giữ lại để không mất giá trị
    if (
      category &&
      category !== 'other' &&
      category !== CREATE_NEW_OPTION_VALUE &&
      !map.has(category)
    ) {
      map.set(category, categoryName || getMapLayerCategoryLabel(category))
    }

    return Array.from(map.entries()).map(([value, labelText]) => ({
      value,
      label: labelText,
    }))
  }, [categories, category, categoryName])

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) return options
    const queryLower = query.toLowerCase()
    const queryNoTone = removeVietnameseTones(query)
    return options.filter((opt) => {
      const labelLower = opt.label.toLowerCase()
      const valueLower = opt.value.toLowerCase()
      const labelNoTone = removeVietnameseTones(opt.label)
      return (
        labelLower.includes(queryLower) ||
        valueLower.includes(queryLower) ||
        labelNoTone.includes(queryNoTone)
      )
    })
  }, [options, searchQuery])

  const displayLabel = useMemo(() => {
    if (isAddingNew || category === 'other') {
      return '+ Thêm danh mục mới...'
    }
    if (!category) return null
    const matched = options.find((o) => o.value === category)
    return matched?.label || categoryName || getMapLayerCategoryLabel(category) || category
  }, [category, categoryName, isAddingNew, options])

  const handleSelectChange = (val: string) => {
    if (val === CREATE_NEW_OPTION_VALUE || val === 'other') {
      setIsAddingNew(true)
      setLocalError(null)
      return
    }

    setIsAddingNew(false)
    setLocalError(null)
    onCategoryChange(val)
    const matched = options.find((o) => o.value === val)
    onCategoryNameChange?.(matched?.label || getMapLayerCategoryLabel(val))
  }

  const handleStartCreateNew = () => {
    setIsOpen(false)
    setIsAddingNew(true)
    const trimmed = searchQuery.trim()
    if (trimmed && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase())) {
      setNewCategoryName(trimmed)
    }
    setSearchQuery('')
  }

  const handleSaveNewCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setLocalError('Vui lòng nhập tên danh mục')
      return
    }
    if (trimmed.length < 2) {
      setLocalError('Tên danh mục phải có ít nhất 2 ký tự')
      return
    }
    if (trimmed.length > 120) {
      setLocalError('Tên danh mục không được vượt quá 120 ký tự')
      return
    }

    setLocalError(null)
    try {
      const created = await createCategory(trimmed)
      onCategoryChange(created.key)
      onCategoryNameChange?.(created.name)
      setIsAddingNew(false)
      setNewCategoryName('')
      toast.success(`Đã thêm và chọn danh mục "${created.name}".`)
    } catch (err: unknown) {
      const anyErr = err as {
        body?: { message?: string }
        response?: { data?: { message?: string } }
        message?: string
      }
      const msg =
        anyErr?.body?.message ||
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        'Không thể tạo danh mục mới'
      setLocalError(msg)
    }
  }

  const handleCancelNew = () => {
    setIsAddingNew(false)
    setNewCategoryName('')
    setLocalError(null)
    if (category === 'other') {
      onCategoryChange('')
      onCategoryNameChange?.('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveNewCategory()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelNew()
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        {label && (
          <Label htmlFor={id}>
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            disabled={disabled || isCreating}
            className={cn(
              'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 text-left',
              isError && 'border-destructive text-destructive',
              !category && !isError && 'text-muted-foreground'
            )}
          >
            <span className="truncate flex items-center gap-1.5">
              {isError ? (
                <>
                  <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                  <span>Lỗi tải danh mục (nhấn để xem/thử lại)</span>
                </>
              ) : isLoading && !options.length ? (
                'Đang tải danh mục...'
              ) : (
                displayLabel || 'Chọn nhóm lớp'
              )}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
          align="start"
        >
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground opacity-60" />
            <input
              type="text"
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
              placeholder="Tìm kiếm danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Xóa từ khóa tìm kiếm</TooltipContent>
              </Tooltip>
            )}
          </div>

          <ScrollArea className="h-60">
            <div className="p-1 divide-y divide-border/20">
              {isError ? (
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="flex items-center text-destructive gap-1.5 text-xs font-semibold">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Không thể tải danh sách danh mục</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-words max-w-[240px]">
                    {(categoriesError as Error)?.message || 'Đã xảy ra lỗi khi kết nối máy chủ.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 cursor-pointer"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="size-3" />
                    <span>Thử lại</span>
                  </Button>
                </div>
              ) : isLoading && !filteredOptions.length ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Đang tìm kiếm...</span>
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Không tìm thấy danh mục nào phù hợp.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = category === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        handleSelectChange(opt.value)
                        setIsOpen(false)
                        setSearchQuery('')
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm text-left transition-colors',
                        isSelected
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span className="truncate pr-2">{opt.label}</span>
                      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-1 space-y-0.5 bg-muted/20">
            <button
              type="button"
              onClick={handleStartCreateNew}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>+ Thêm danh mục mới...</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {isAddingNew && (
        <div className="bg-muted/40 border-border/80 space-y-2 rounded-md border p-2.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-custom-name`} className="text-xs font-semibold text-foreground">
              Tên danh mục mới <span className="text-destructive">*</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCancelNew}
                  disabled={isCreating}
                  aria-label="Đóng thêm mới"
                  className="text-muted-foreground hover:text-foreground h-5 w-5"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Đóng thêm mới</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex gap-2">
            <Input
              id={`${id}-custom-name`}
              placeholder={customCategoryPlaceholder || 'Nhập tên danh mục (VD: Ngập ven biển)'}
              value={newCategoryName}
              maxLength={120}
              disabled={disabled || isCreating}
              onChange={(e) => {
                setNewCategoryName(e.target.value)
                if (localError) setLocalError(null)
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNewCategory}
              disabled={disabled || isCreating || !newCategoryName.trim()}
              className="shrink-0"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 size-3.5" />
                  Lưu
                </>
              )}
            </Button>
          </div>

          {localError && <p className="text-destructive text-xs">{localError}</p>}
          <p className="text-muted-foreground text-[11px] leading-tight">
            Danh mục sau khi lưu sẽ tự động được chọn và lưu vào hệ thống để dùng lại cho các lần sau.
          </p>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between text-destructive text-xs py-0.5">
          <span className="flex items-center gap-1 truncate">
            <AlertCircle className="size-3 shrink-0" />
            <span className="truncate">Lỗi tải danh mục: {(categoriesError as Error)?.message || 'Không thể lấy dữ liệu'}</span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="underline text-[11px] font-medium hover:text-destructive/80 cursor-pointer ml-2 shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {error && !isAddingNew && !isError && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
