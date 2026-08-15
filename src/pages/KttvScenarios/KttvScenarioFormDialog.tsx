import { useEffect, useMemo } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2, Pen, Plus } from 'lucide-react'
import { toast } from 'react-toastify'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { kttvScenarioService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse } from '@/types/api'
import type { FloodScenario, FloodScenarioWriteBody } from '@/service/kttvScenarioService'

const scenarioSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Mã kịch bản là bắt buộc')
    .max(100, 'Mã kịch bản không được vượt quá 100 ký tự'),
  name: z
    .string()
    .trim()
    .min(1, 'Tên kịch bản là bắt buộc')
    .max(200, 'Tên kịch bản không được vượt quá 200 ký tự'),
  matchPriority: z.string().optional().or(z.literal('')),
  matchRuleText: z.string().optional().or(z.literal('')),
  isEnabled: z.boolean(),
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

function formatRule(value: FloodScenario['matchRule']) {
  if (!value) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema) as any,
    defaultValues: {
      code: '',
      name: '',
      matchPriority: '',
      matchRuleText: '',
      isEnabled: true,
    },
  })

  useEffect(() => {
    if (!open) {
      reset({
        code: '',
        name: '',
        matchPriority: '',
        matchRuleText: '',
        isEnabled: true,
      })
      return
    }

    if (scenario) {
      reset({
        code: scenario.code ?? '',
        name: scenario.name ?? '',
        matchPriority:
          scenario.matchPriority !== undefined && scenario.matchPriority !== null
            ? String(scenario.matchPriority)
            : '',
        matchRuleText: formatRule(scenario.matchRule),
        isEnabled: scenario.isEnabled !== false,
      })
    } else if (!isEdit) {
      reset({
        code: '',
        name: '',
        matchPriority: '',
        matchRuleText: '',
        isEnabled: true,
      })
    }
  }, [isEdit, open, reset, scenario])

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

  const handleFormSubmit: SubmitHandler<ScenarioFormValues> = (values) => {
    const payload: FloodScenarioWriteBody = {
      code: values.code.trim(),
      name: values.name.trim(),
      isEnabled: values.isEnabled,
    }

    const priorityValue = values.matchPriority?.trim()
    if (priorityValue) {
      const parsedPriority = Number(priorityValue)
      if (!Number.isFinite(parsedPriority)) {
        toast.error('Ưu tiên phải là một số hợp lệ')
        return
      }
      payload.matchPriority = parsedPriority
    }

    const ruleValue = values.matchRuleText?.trim()
    if (ruleValue) {
      try {
        payload.matchRule = JSON.parse(ruleValue)
      } catch {
        toast.error('matchRule phải là JSON hợp lệ')
        return
      }
    } else {
      payload.matchRule = null
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
                {isEdit
                  ? `Cập nhật kịch bản #${scenarioId}`
                  : 'Nhập thông tin để tạo kịch bản mới'}
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
                <Input id="code" {...register('code')} placeholder="FLOOD_HIGH_TIDE" />
                {errors.code && <p className="text-destructive text-sm">{errors.code.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên kịch bản <span className="text-destructive">*</span>
                </Label>
                <Input id="name" {...register('name')} placeholder="Kịch bản ngập lụt lớn" />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="matchPriority">Ưu tiên</Label>
                <Input
                  id="matchPriority"
                  {...register('matchPriority')}
                  placeholder="10"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={watch('isEnabled') ? 'true' : 'false'}
                  onValueChange={(value) => setValue('isEnabled', value === 'true')}
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
              <Label htmlFor="matchRule">matchRule (JSON)</Label>
              <Textarea
                id="matchRule"
                {...register('matchRuleText')}
                placeholder='{"all":[{"variable":"water_level","op":"gte","value":1.5}]}'
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Để trống nếu kịch bản không cần điều kiện JSON.
              </p>
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