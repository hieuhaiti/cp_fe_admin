import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CloudRain,
  Waves,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCw,
  Layers,
  AlertTriangle,
  PowerOff,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { kttvScenarioService, weatherForecastService } from '@/service'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import type { ApiResponse } from '@/types/api'
import type {
  FloodScenario,
  FloodScenarioListData,
  FloodSimulationResult,
} from '@/service/kttvScenarioService'
import ScenarioResultCards from './ScenarioResultCards'
import { SCENARIO_TYPES, type ScenarioTypeId } from './constants'
import {
  inferScenarioType,
  scenarioFromDb,
  simulateThreeTypesFromList,
} from './helpers'
import type { ThreeTypeSimulationOutcome, TypeSimulationMatch } from './types'

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
  duration: z.string(),
})

type InputFormValues = z.infer<typeof inputSchema>

export default function KttvInputForm(): JSX.Element {
  const queryClient = useQueryClient()
  const [simResult, setSimResult] = useState<FloodSimulationResult | null>(null)
  const [threeTypeOutcome, setThreeTypeOutcome] = useState<ThreeTypeSimulationOutcome | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [activating, setActivating] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [refreshingForecast, setRefreshingForecast] = useState(false)
  const [selectedHour, setSelectedHour] = useState<string>('')
  const [submittedRainfall, setSubmittedRainfall] = useState<number | null>(null)

  // Tải dữ liệu dự báo 24 giờ từ backend
  const {
    data: forecastData,
    isLoading: isForecastLoading,
    isError: isForecastError,
    refetch: refetchForecast,
  } = useQuery({
    queryKey: ['admin-weather-forecast-24h'],
    queryFn: async () => {
      const res = await weatherForecastService.getForecast()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Tải danh sách kịch bản thực tế từ hệ thống để tính toán 3 loại
  const { data: scenarioListData } = useQuery({
    queryKey: ['admin-scenarios-for-simulation'],
    queryFn: async () => {
      const res = await kttvScenarioService.getAll({ limit: 100 })
      const raw = res?.data as FloodScenarioListData | undefined
      return raw?.items ?? []
    },
    staleTime: 60 * 1000,
  })

  const currentHourStr = `${String(new Date().getHours()).padStart(2, '0')}:00`
  const activeHour = selectedHour || currentHourStr

  // Tải trạng thái lịch trình 24 giờ (để hiển thị khung giờ nào đang bị khóa thủ công)
  const { data: scheduleData } = useQuery({
    queryKey: ['admin-flood-forecast-schedule'],
    queryFn: async () => {
      const res = await kttvScenarioService.getForecastSchedule()
      return res?.data ?? []
    },
    staleTime: 60 * 1000,
  })

  const activeSlot = (scheduleData ?? []).find((s) => s.hour_str === activeHour)
  const isManualHour = Boolean(activeSlot?.is_manual_override || activeSlot?.status === 'MANUAL')

  async function handleResetToAuto() {
    try {
      await kttvScenarioService.resetToAuto({ hour: activeHour })
      toast.success(`Đã khôi phục mốc giờ ${activeHour} về chế độ tự động hóa (Cron)`)
      queryClient.invalidateQueries({ queryKey: ['admin-flood-forecast-schedule'] })
    } catch (err: unknown) {
      toast.error(getMappedErrorMessage(err, 'Lỗi khi khôi phục chế độ tự động'))
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InputFormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: { rainfall: '', tide: '', duration: '1h' },
  })

  // Áp dụng lượng mưa từ mốc giờ dự báo vào form
  function handleApplyForecast(targetHour?: string) {
    const hourKey = targetHour || activeHour
    const hours = forecastData?.hours ?? []
    const matched = hours.find((h) => h.hour === hourKey) || hours[0]
    if (!matched) {
      toast.warning('Chưa có dữ liệu dự báo để áp dụng')
      return
    }
    const rain = matched.precipMm
    setValue('rainfall', String(rain))
    setValue('duration', '1h')
    toast.info(
      `Đã nhập lượng mưa dự báo lúc ${matched.hour}: ${rain} mm/h`
    )
  }

  // Làm mới dữ liệu dự báo từ WeatherAPI qua server
  async function handleRefreshForecast() {
    setRefreshingForecast(true)
    try {
      const res = await weatherForecastService.refreshForecast()
      if (res.data) {
        queryClient.setQueryData(['admin-weather-forecast-24h'], res.data)
        toast.success(
          `Đã cập nhật dự báo 24 giờ (${res.data.forecastDate ?? 'hôm nay'})`
        )
      }
    } catch (err: unknown) {
      toast.error(getMappedErrorMessage(err, 'Lỗi khi làm mới dữ liệu dự báo từ máy chủ'))
    } finally {
      setRefreshingForecast(false)
    }
  }

  async function onSubmit(values: InputFormValues) {
    setSimLoading(true)
    setSimResult(null)
    setThreeTypeOutcome(null)

    const rainVal = Number(values.rainfall)
    const tideVal = values.tide ? Number(values.tide) : null
    const durationVal = values.duration || '1h'
    setSubmittedRainfall(rainVal)

    // 1. Tính toán kết quả cho cả 3 loại kịch bản từ dữ liệu thực tế
    const realItems = (scenarioListData ?? []).map(scenarioFromDb)
    if (realItems.length > 0) {
      const outcome = simulateThreeTypesFromList(realItems, rainVal, tideVal, durationVal)
      setThreeTypeOutcome(outcome)
    }

    // 2. Tra cứu API backend hiện hữu (chỉ gọi khi lượng mưa > 0)
    if (rainVal > 0) {
      try {
        const res = await kttvScenarioService.simulate({
          rainfall: rainVal,
          tide: tideVal,
        })
        setSimResult(res?.data ?? null)
      } catch (err: unknown) {
        toast.error(getMappedErrorMessage(err, 'Lỗi khi tra cứu kịch bản từ máy chủ'))
      } finally {
        setSimLoading(false)
      }
    } else {
      setSimResult(null)
      setSimLoading(false)
    }
  }

  const matchedScenarios = useMemo(() => {
    if (submittedRainfall !== null && submittedRainfall <= 0) {
      return []
    }

    const list: Array<{
      type: ScenarioTypeId
      typeLabel: string
      rcpLabel?: string
      scenarioId: number | string
      scenarioCode: string
      scenarioName: string
      layerCode: string
      layerName?: string
    }> = []

    if (threeTypeOutcome) {
      const candidates = [
        threeTypeOutcome.hienTrang,
        threeTypeOutcome.caiTao,
        threeTypeOutcome.quyHoachRcp45,
        threeTypeOutcome.quyHoachRcp85,
      ]
      candidates.forEach((c) => {
        if (c.status === 'matched' && c.scenario) {
          if (!list.some((existing) => String(existing.scenarioId) === String(c.scenario!.id))) {
            list.push({
              type: c.type,
              typeLabel: c.typeLabel,
              rcpLabel: c.rcpLabel,
              scenarioId: c.scenario.id,
              scenarioCode: c.scenario.code,
              scenarioName: c.scenario.nameVi,
              layerCode: c.layerCode || c.scenario.layerCode,
              layerName: c.layerName || c.scenario.layerName,
            })
          }
        }
      })
    }

    if (
      list.length === 0 &&
      simResult &&
      simResult.status !== 'no_rain' &&
      simResult.simulationParams?.scenarioCode !== 'no_rain'
    ) {
      list.push({
        type: 'hien_trang',
        typeLabel: 'Hiện trạng ngập lụt',
        scenarioId: simResult.simulationParams.scenarioId || 0,
        scenarioCode: simResult.simulationParams.scenarioCode,
        scenarioName: simResult.simulationParams.scenarioName,
        layerCode: simResult.simulationParams.matchedLayerCode || simResult.code,
        layerName: simResult.nameVi,
      })
    }

    return list
  }, [threeTypeOutcome, simResult, submittedRainfall])

  async function handleDeactivateAllScenarios() {
    setDeactivating(true)
    try {
      const tideVal = watch('tide') ? Number(watch('tide')) : null
      const res = await kttvScenarioService.setManualOverride({
        hour: activeHour,
        rainfall: 0,
        tide: tideVal,
      })

      const count = res?.data?.deactivatedCount ?? (scenarioListData ?? []).filter((s) => s.is_active).length
      toast.success(
        `Đã tắt toàn bộ ${count} kịch bản ngập đang bật và khóa mốc ${activeHour} ở chế độ thủ công (0 mm/h)`
      )

      queryClient.invalidateQueries({ queryKey: ['kttv-scenarios'] })
      queryClient.invalidateQueries({ queryKey: ['admin-scenarios-for-simulation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-flood-forecast-schedule'] })
    } catch (err: unknown) {
      toast.error(getMappedErrorMessage(err, 'Lỗi khi tắt các kịch bản ngập'))
    } finally {
      setDeactivating(false)
    }
  }

  async function handleActivateLayer() {
    if (matchedScenarios.length === 0) return
    setActivating(true)
    try {
      const watchedRain = Number(watch('rainfall'))
      const rainVal = Number.isFinite(watchedRain) ? watchedRain : (submittedRainfall ?? 0)
      const tideVal = watch('tide') ? Number(watch('tide')) : null

      const allRes = await kttvScenarioService.getAll({ page: 1, limit: 100 })
      const items: FloodScenario[] =
        (allRes as ApiResponse<FloodScenarioListData>)?.data?.items ?? []

      const targetIds = matchedScenarios.map((m) => String(m.scenarioId))
      const targetTypes = Array.from(new Set(matchedScenarios.map((m) => m.type)))

      // 1. Deactivate các kịch bản đang active thuộc các nhóm loại này nhưng không phải kịch bản khớp
      const toDeactivate = items.filter((s) => {
        if (!s.is_active) return false
        if (targetIds.includes(String(s.id))) return false
        const sType = (s.type || inferScenarioType(s).type) as ScenarioTypeId
        return targetTypes.includes(sType)
      })

      // 2. Activate các kịch bản khớp mà chưa active (đồng bộ ngay lượng mưa & triều tại thời điểm kích hoạt)
      const toActivate = matchedScenarios.filter((m) => {
        const existing = items.find((s) => String(s.id) === String(m.scenarioId))
        return existing ? !existing.is_active : true
      })

      await Promise.all([
        ...toDeactivate.map((s) => kttvScenarioService.update(s.id, { isActive: false })),
        ...toActivate.map((m) =>
          kttvScenarioService.update(m.scenarioId, {
            isActive: true,
            ...(m.type === 'hien_trang' && Number.isFinite(rainVal) && rainVal >= 0
              ? {
                  currentRainfall: rainVal,
                  rainfallSource: 'MANUAL',
                  currentTide: tideVal,
                  tideSource: 'MANUAL',
                }
              : {}),
          })
        ),
      ])

      // Nếu có kịch bản hiện trạng, khóa thủ công khung giờ này kể cả khi lượng mưa bằng 0
      // để cron không ghi đè ý chí vận hành của người dùng.
      const hienTrangMatch = matchedScenarios.find((m) => m.type === 'hien_trang')
      if (hienTrangMatch && Number.isFinite(rainVal) && rainVal >= 0) {
        await kttvScenarioService.setManualOverride({
          hour: activeHour,
          rainfall: rainVal,
          tide: tideVal,
          scenarioId: hienTrangMatch.scenarioId,
        })
        queryClient.invalidateQueries({ queryKey: ['admin-flood-forecast-schedule'] })
      }

      if (matchedScenarios.length > 1) {
        const details = matchedScenarios
          .map((m) => `[${m.typeLabel}] "${m.scenarioName}" — lớp "${m.layerCode || m.layerName}"`)
          .join('; ')
        toast.success(`Đã kích hoạt đồng thời ${matchedScenarios.length} kịch bản: ${details}`)
      } else {
        const single = matchedScenarios[0]
        toast.success(
          `Đã kích hoạt kịch bản [${single.typeLabel}] "${single.scenarioName}" — lớp "${single.layerCode || single.layerName}"`
        )
      }

      queryClient.invalidateQueries({ queryKey: ['kttv-scenarios'] })
      queryClient.invalidateQueries({ queryKey: ['admin-scenarios-for-simulation'] })
    } catch (err: unknown) {
      toast.error(getMappedErrorMessage(err, 'Lỗi khi kích hoạt kịch bản'))
    } finally {
      setActivating(false)
    }
  }

  async function handleActivateSpecificType(match: TypeSimulationMatch) {
    if (!match.scenario) return
    const targetId = String(match.scenario.id)
    const targetType = match.type
    setActivating(true)
    try {
      const watchedRain = Number(watch('rainfall'))
      const rainVal = Number.isFinite(watchedRain) ? watchedRain : (submittedRainfall ?? 0)
      const tideVal = watch('tide') ? Number(watch('tide')) : null

      const allRes = await kttvScenarioService.getAll({ page: 1, limit: 100 })
      const items: FloodScenario[] =
        (allRes as ApiResponse<FloodScenarioListData>)?.data?.items ?? []

      // Deactivate các kịch bản cùng loại đang active
      const toDeactivate = items.filter((s) => {
        if (!s.is_active) return false
        if (String(s.id) === targetId) return false
        const sType = (s.type || inferScenarioType(s).type) as ScenarioTypeId
        return sType === targetType
      })

      await Promise.all([
        ...toDeactivate.map((s) => kttvScenarioService.update(s.id, { isActive: false })),
        kttvScenarioService.update(match.scenario.id, {
          isActive: true,
          ...(match.type === 'hien_trang' && Number.isFinite(rainVal) && rainVal >= 0
            ? {
                currentRainfall: rainVal,
                rainfallSource: 'MANUAL',
                currentTide: tideVal,
                tideSource: 'MANUAL',
              }
            : {}),
        }),
      ])

      if (match.type === 'hien_trang' && Number.isFinite(rainVal) && rainVal >= 0) {
        await kttvScenarioService.setManualOverride({
          hour: activeHour,
          rainfall: rainVal,
          tide: tideVal,
          scenarioId: match.scenario.id,
        })
        queryClient.invalidateQueries({ queryKey: ['admin-flood-forecast-schedule'] })
      }

      toast.success(
        `Đã kích hoạt kịch bản [${match.typeLabel}] "${match.scenario.nameVi}" — lớp "${match.layerCode || match.scenario.layerCode || match.scenario.nameVi}"`
      )

      queryClient.invalidateQueries({ queryKey: ['kttv-scenarios'] })
      queryClient.invalidateQueries({ queryKey: ['admin-scenarios-for-simulation'] })
    } catch (err: unknown) {
      toast.error(getMappedErrorMessage(err, 'Lỗi khi kích hoạt kịch bản'))
    } finally {
      setActivating(false)
    }
  }

  const isZeroRainfall = submittedRainfall !== null && submittedRainfall <= 0
  const activeScenariosInSystem = (scenarioListData ?? []).filter((s) => s.is_active)
  const hasMatch =
    matchedScenarios.length > 0 ||
    (!!simResult &&
      simResult.status !== 'no_rain' &&
      simResult.simulationParams?.scenarioCode !== 'no_rain')
  const isSimulated = submittedRainfall !== null || !!threeTypeOutcome || !!simResult
  const selectedItem = (forecastData?.hours ?? []).find((h) => h.hour === activeHour)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border bg-card p-5 shadow-xs">
        {/* Khối Dự báo thời tiết 24h WeatherAPI */}
        <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <CloudRain className="size-4 text-primary" />
              <span>Dự báo thời tiết 24h Cẩm Phả</span>
              {forecastData?.forecastDate && (
                <div>
                  <span className="text-muted-foreground text-[11px] font-normal">
                    — Ngày {forecastData.forecastDate}
                  </span>
                  <span className="text-muted-foreground text-[11px] font-normal">
                    — Nguồn cung cấp: WeatherAPI
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {forecastData?.fetchedAt && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  Cập nhật: {new Date(forecastData.fetchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleRefreshForecast}
                disabled={refreshingForecast || isForecastLoading}
                className="h-6 px-2 text-xs flex items-center gap-1"
              >
                <RotateCw className={`size-3 ${refreshingForecast ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>
          </div>

          {isForecastLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Đang tải dữ liệu dự báo 24 giờ từ máy chủ...</span>
            </div>
          ) : isForecastError ? (
            <div className="flex items-center justify-between text-xs text-destructive py-1">
              <span>Không thể tải dữ liệu dự báo thời tiết từ máy chủ.</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => refetchForecast()}
                className="h-5 px-1.5 text-xs text-primary"
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-0.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={activeHour}
                    onValueChange={setSelectedHour}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background w-full">
                      <SelectValue placeholder="Chọn mốc giờ dự báo (24h)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {(forecastData?.hours ?? []).map((h) => (
                        <SelectItem key={h.time} value={h.hour}>
                          {h.hour} — {h.precipMm > 0 ? `${h.precipMm} mm/h` : 'Không mưa'} — {h.tempC}°C {h.condition?.text ? `(${h.condition.text})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => handleApplyForecast(activeHour)}
                  className="h-8 px-2.5 text-xs font-medium flex items-center justify-center gap-1 shrink-0"
                >
                  <Zap className="size-3 text-amber-500" />
                  Dùng dự báo mốc này ({selectedItem?.precipMm ?? 0} mm/h)
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs px-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Chế độ mốc {activeHour}:</span>
                  {isManualHour ? (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[11px] font-medium">
                      Thủ công 
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[11px] font-medium">
                      Tự động 
                    </Badge>
                  )}
                </div>
                {isManualHour && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleResetToAuto}
                    className="h-5 px-1.5 text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="size-3" />
                    Khôi phục Tự động
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rainfall */}
          <div className="space-y-2">
            <div className="kttv-form-field-header justify-between">
              <Label htmlFor="rainfall" className="flex items-center gap-1.5 text-xs font-semibold">
                <CloudRain className="size-4 text-primary" />
                Lượng mưa hiện tại (mm/h) <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleApplyForecast(activeHour)}
                disabled={isForecastLoading}
                className="h-6 px-1.5 text-xs text-primary"
              >
                {isForecastLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Zap className="size-3" />
                )}
                Tự động
              </Button>
            </div>
            <Input
              id="rainfall"
              {...register('rainfall')}
              placeholder="Nhập lượng mưa (VD: 130)"
              inputMode="decimal"
            />
            {errors.rainfall && (
              <p className="text-destructive text-xs">{errors.rainfall.message as string}</p>
            )}
          </div>

          {/* Tide */}
          <div className="space-y-2">
            <div className="kttv-form-field-header">
              <Label htmlFor="tide" className="flex items-center gap-1.5 text-xs font-semibold">
                <Waves className="size-4 text-muted-foreground" />
                Mực triều (m) <span className="text-muted-foreground text-xs">(tùy chọn)</span>
              </Label>
            </div>
            <Input
              id="tide"
              {...register('tide')}
              placeholder="VD: 0.837"
              inputMode="decimal"
            />
            {errors.tide && (
              <p className="text-destructive text-xs">{errors.tide.message as string}</p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={simLoading} className="w-full">
          {simLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang tra cứu đồng thời 3 loại kịch bản...
            </>
          ) : (
            'Tra cứu kịch bản'
          )}
        </Button>
      </form>

      {/* Hiển thị kết quả 3 loại kịch bản đồng thời */}
      {threeTypeOutcome && (
        <ScenarioResultCards
          outcome={threeTypeOutcome}
          onActivateType={handleActivateSpecificType}
          isActivating={activating}
        />
      )}

      {/* Kết quả khi lượng mưa bằng 0 (Không mưa) */}
      {isSimulated && isZeroRainfall && (
        <div
          className={`rounded-lg border p-4 space-y-3.5 ${
            activeScenariosInSystem.length > 0
              ? 'border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              {activeScenariosInSystem.length > 0 ? (
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {activeScenariosInSystem.length > 0
                  ? 'Lượng mưa 0 mm/h — Đang có kịch bản ngập kích hoạt trong hệ thống'
                  : 'Lượng mưa 0 mm/h — Không có kịch bản ngập nào đang bật'}
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                activeScenariosInSystem.length > 0
                  ? 'text-amber-800 border-amber-300 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 text-xs font-semibold'
                  : 'text-emerald-800 border-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs font-semibold'
              }
            >
              {activeScenariosInSystem.length > 0
                ? `${activeScenariosInSystem.length} kịch bản đang bật`
                : 'Tất cả đang tắt'}
            </Badge>
          </div>

          {activeScenariosInSystem.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Hệ thống xác định hiện tại <strong>không mưa</strong>. Để tránh hiển thị ngập giả lập trên bản đồ WebGIS, bạn hãy tắt các kịch bản đang bật:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeScenariosInSystem.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-md border border-amber-200/80 bg-card/90 p-3 space-y-1 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`scenario-type-badge ${s.type || 'hien_trang'}`}>
                        {SCENARIO_TYPES[s.type as ScenarioTypeId]?.shortLabel ?? 'Hiện trạng'}
                      </span>
                      <span className="font-mono text-muted-foreground text-[11px] truncate max-w-[120px]">
                        {s.code}
                      </span>
                    </div>
                    <div className="font-semibold text-foreground text-sm truncate" title={s.name_vi}>
                      {s.name_vi}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Lớp: <code className="font-mono">{s.layer_code}</code>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeactivateAllScenarios}
                  disabled={deactivating}
                  className="flex items-center gap-1.5"
                >
                  {deactivating ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Đang tắt các kịch bản...
                    </>
                  ) : (
                    <>
                      <PowerOff className="size-4" />
                      Tắt tất cả các kịch bản hiện tại ({activeScenariosInSystem.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Toàn bộ các kịch bản ngập lụt hiện đang ở trạng thái tắt. Bản đồ WebGIS hiển thị lớp nền thông thường, an toàn.
            </p>
          )}
        </div>
      )}

      {/* Kết quả tra cứu kịch bản phù hợp khi mưa > 0 */}
      {isSimulated && !isZeroRainfall && (
        <div
          className={`rounded-lg border p-4 space-y-3.5 ${
            hasMatch
              ? 'border-green-300 bg-green-50/80 dark:border-green-800 dark:bg-green-950/30'
              : 'border-yellow-300 bg-yellow-50/80 dark:border-yellow-800 dark:bg-yellow-950/30'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              {hasMatch ? (
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="size-5 text-yellow-600 dark:text-yellow-400" />
              )}
              <span>{hasMatch ? 'Đã tìm thấy kịch bản phù hợp' : 'Không có kịch bản phù hợp'}</span>
            </div>
            {hasMatch && matchedScenarios.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                Khớp {matchedScenarios.length} loại kịch bản
              </span>
            )}
          </div>

          {hasMatch && matchedScenarios.length > 0 ? (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Kịch bản tương ứng theo từng loại sẽ được kích hoạt đồng thời vào hệ thống:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {matchedScenarios.map((item) => (
                  <div
                    key={item.scenarioId}
                    className="rounded-md border border-green-200/80 bg-card/90 p-3 space-y-1.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`scenario-type-badge ${item.type}`}>
                        {SCENARIO_TYPES[item.type]?.shortLabel ?? item.typeLabel}
                        {item.rcpLabel ? ` (${item.rcpLabel})` : ''}
                      </span>
                    </div>
                    <div className="font-semibold text-foreground text-sm truncate" title={item.scenarioName}>
                      {item.scenarioName}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Layers className="size-3.5 shrink-0" />
                      <span className="truncate" title={item.layerName ? `${item.layerName} (${item.layerCode})` : item.layerCode}>
                        Lớp: <code className="font-mono">{item.layerCode}</code>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            simResult && (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Kịch bản kích hoạt máy chủ:</span>{' '}
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
              </div>
            )
          )}

          {hasMatch && (
            <Button
              variant="default"
              size="sm"
              onClick={handleActivateLayer}
              disabled={activating}
            >
              {activating ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Đang kích hoạt...
                </>
              ) : matchedScenarios.length > 1 ? (
                `Kích hoạt đồng thời cả ${matchedScenarios.length} kịch bản từng loại`
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
