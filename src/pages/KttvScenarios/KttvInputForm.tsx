import { useState } from 'react'
import type { JSX } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CloudRain, Waves, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { kttvScenarioService } from '@/service'
import type { ApiResponse } from '@/types/api'
import type { FloodScenario, FloodSimulationResult } from '@/service/kttvScenarioService'

const CAM_PHA = { lng: 107.303749, lat: 21.002361 }
const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY as string

async function fetchOwmWeather() {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${CAM_PHA.lat}&lon=${CAM_PHA.lng}&appid=${OWM_KEY}&units=metric`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenWeatherMap ${res.status}`)
  return res.json() as Promise<{ rain?: { '1h'?: number }; name?: string }>
}

const inputSchema = z.object({
  rainfall: z
    .string()
    .min(1, 'Lượng mưa là bắt buộc')
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Lượng mưa phải là số không âm'),
  tide: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || !isNaN(Number(v)), 'Mực nước phải là số'),
})

type InputFormValues = z.infer<typeof inputSchema>

export default function KttvInputForm(): JSX.Element {
  const queryClient = useQueryClient()
  const [simResult, setSimResult] = useState<FloodSimulationResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [activating, setActivating] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<InputFormValues>({
    resolver: zodResolver(inputSchema) as any,
    defaultValues: { rainfall: '', tide: '' },
  })

  async function handleAutoFill() {
    setAutoLoading(true)
    try {
      const data = await fetchOwmWeather()
      const rain = data?.rain?.['1h'] ?? 0
      setValue('rainfall', String(rain))
      toast.info(`Đã nhập lượng mưa từ OpenWeatherMap (${data.name ?? 'Cẩm Phả'}): ${rain} mm/h`)
    } catch {
      toast.error('Không lấy được dữ liệu thời tiết từ OpenWeatherMap')
    } finally {
      setAutoLoading(false)
    }
  }

  async function onSubmit(values: InputFormValues) {
    setSimLoading(true)
    setSimResult(null)
    try {
      const res = await kttvScenarioService.simulate({
        rainfall: Number(values.rainfall),
        tide: values.tide ? Number(values.tide) : null,
      })
      const result = (res as ApiResponse<FloodSimulationResult>)?.data ?? (res as any)
      setSimResult(result)
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? 'Lỗi khi tra cứu kịch bản')
    } finally {
      setSimLoading(false)
    }
  }

  async function handleActivateLayer() {
    if (!simResult) return
    const { scenarioId, scenarioCode, scenarioName } = simResult.simulationParams
    setActivating(true)
    try {
      // Fetch all scenarios to resolve matched id and find currently active ones
      const allRes = await kttvScenarioService.getAll({ page: 1, limit: 100 })
      const items: FloodScenario[] =
        (allRes as ApiResponse<any>)?.data?.items ?? []

      // scenarioId may be null when server used hardcoded fallback — resolve via code
      let matchedId = scenarioId ? Number(scenarioId) : 0
      if (!matchedId && scenarioCode) {
        const byCode = items.find((s) => s.code === scenarioCode)
        matchedId = byCode ? Number(byCode.id) : 0
      }

      if (!matchedId || matchedId <= 0) {
        toast.warning(
          `Kịch bản "${scenarioName}" chưa có trong hệ thống — không thể kích hoạt tự động.`,
        )
        return
      }

      // Deactivate all active scenarios except the matched one
      const toDeactivate = items.filter((s) => s.is_active && Number(s.id) !== matchedId)
      await Promise.all(
        toDeactivate.map((s) => kttvScenarioService.update(Number(s.id), { isActive: false }))
      )

      // Activate matched scenario
      await kttvScenarioService.update(matchedId, { isActive: true })

      toast.success(
        `Đã kích hoạt kịch bản "${scenarioName}" — lớp "${simResult.nameVi}"`,
      )
      queryClient.invalidateQueries({ queryKey: ['kttv-scenarios'] })
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? 'Lỗi khi kích hoạt kịch bản')
    } finally {
      setActivating(false)
    }
  }

  const matched = !!simResult

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Rainfall */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="rainfall" className="flex items-center gap-1.5">
              <CloudRain className="size-4" />
              Lượng mưa hiện tại (mm/h) <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              disabled={autoLoading}
            >
              {autoLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Tự động nhập
            </Button>
          </div>
          <Input
            id="rainfall"
            {...register('rainfall')}
            placeholder="0"
            inputMode="decimal"
          />
          {errors.rainfall && (
            <p className="text-destructive text-sm">{errors.rainfall.message as string}</p>
          )}
        </div>

        {/* Tide */}
        <div className="space-y-2">
          <Label htmlFor="tide" className="flex items-center gap-1.5">
            <Waves className="size-4" />
            Mực nước thủy triều (m) <span className="text-muted-foreground text-xs">(tùy chọn)</span>
          </Label>
          <Input
            id="tide"
            {...register('tide')}
            placeholder="để trống nếu không có dữ liệu triều"
            inputMode="decimal"
          />
          {errors.tide && (
            <p className="text-destructive text-sm">{errors.tide.message as string}</p>
          )}
        </div>

        <Button type="submit" disabled={simLoading} className="w-full">
          {simLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang tra cứu...
            </>
          ) : (
            'Tra cứu kịch bản'
          )}
        </Button>
      </form>

      {/* Simulation result */}
      {simResult && (
        <div
          className={`rounded-lg border p-4 space-y-3 ${
            matched ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {matched ? (
              <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="size-5 text-yellow-600 dark:text-yellow-400" />
            )}
            {matched ? 'Đã tìm thấy kịch bản phù hợp' : 'Không có kịch bản phù hợp'}
          </div>

          {simResult && (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Kịch bản:</span>{' '}
                <span className="font-medium">{simResult.simulationParams.scenarioName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Mã:</span>{' '}
                <code className="font-mono">{simResult.simulationParams.scenarioCode}</code>
              </p>
              <p>
                <span className="text-muted-foreground">Lớp bản đồ:</span>{' '}
                <code className="font-mono">{simResult.nameVi}</code>
              </p>
              <p>
                <span className="text-muted-foreground">GeoServer:</span>{' '}
                <code className="font-mono text-xs">{simResult.geoserverLayer}</code>
              </p>
            </div>
          )}

          {matched && (
            <Button
              variant="default"
              size="sm"
              onClick={handleActivateLayer}
              disabled={activating}
            >
              {activating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Kích hoạt kịch bản này'
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
