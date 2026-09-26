import type { JSX } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Layers, CloudRain, Sun } from 'lucide-react'
import type { ThreeTypeSimulationOutcome, TypeSimulationMatch } from './types'
import { SCENARIO_TYPES } from './constants'

interface ScenarioResultCardsProps {
  outcome: ThreeTypeSimulationOutcome
  onActivateType?: (match: TypeSimulationMatch) => void
  isActivating?: boolean
}

function SingleTypeCard({
  match,
  onActivate,
  isActivating,
}: {
  match: TypeSimulationMatch
  onActivate?: () => void
  isActivating?: boolean
}): JSX.Element {
  const typeOption = SCENARIO_TYPES[match.type]
  const isMatched = match.status === 'matched' && match.scenario != null

  return (
    <Card
      className={`relative overflow-hidden border transition-all ${
        isMatched
          ? 'border-border/80 bg-card shadow-xs hover:shadow-md'
          : 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-75'
      }`}
    >
      <div
        className="h-1.5 w-full"
        style={{
          backgroundColor:
            match.type === 'hien_trang'
              ? 'hsl(var(--primary))'
              : match.type === 'cai_tao'
              ? 'hsl(var(--success))'
              : 'hsl(var(--warning))',
        }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor:
                match.type === 'hien_trang'
                  ? 'hsl(var(--primary))'
                  : match.type === 'cai_tao'
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--warning))',
            }}
          >
            {typeOption.shortLabel}
          </Badge>
          {match.rcpLabel && (
            <Badge variant="secondary" className="text-[11px]">
              {match.rcpLabel}
            </Badge>
          )}
        </div>
        <CardTitle className="text-base font-semibold">{typeOption.label}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-sm">
        {isMatched && match.scenario ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Khớp kịch bản dự báo</span>
            </div>

            <div className="space-y-2 rounded-md bg-muted/40 p-2.5 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Mã kịch bản:</span>
                <span className="break-words font-mono font-bold text-foreground">
                  {match.scenario.code}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-muted-foreground">Tên:</span>
                <span
                  className="break-words font-medium text-foreground"
                  title={match.scenario.nameVi}
                >
                  {match.scenario.nameVi}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Lớp bản đồ:</span>
                <span className="flex items-center gap-1 break-all font-mono text-foreground">
                  <Layers className="size-3 shrink-0" />
                  {match.scenario.layerCode}
                </span>
              </div>
              {match.scenario.frequency && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Tần suất:</span>
                  <span className="font-medium text-foreground">{match.scenario.frequency}</span>
                </div>
              )}
            </div>

            {onActivate && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onActivate}
                disabled={isActivating}
              >
                {isActivating ? 'Đang kích hoạt...' : 'Kích hoạt riêng kịch bản này'}
              </Button>
            )}
          </>
        ) : match.status === 'no_rain' ? (
          <div className="py-6 text-center space-y-1">
            <Sun className="size-5 mx-auto text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Không có kịch bản ngập</p>
            <p className="text-[11px] text-muted-foreground">
              Mức mưa 0 mm/h — Thời tiết bình thường, không ngập úng.
            </p>
          </div>
        ) : match.status === 'no_flood' ? (
          <div className="py-6 text-center space-y-1">
            <CheckCircle2 className="size-5 mx-auto text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Lượng mưa an toàn — Không gây ngập</p>
            <p className="text-[11px] text-muted-foreground">
              Mức mưa dưới ngưỡng gây ngập tối thiểu. Hệ thống thoát nước đáp ứng tốt, không ngập úng.
            </p>
          </div>
        ) : (
          <div className="py-6 text-center space-y-1">
            <AlertCircle className="size-5 mx-auto text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Chưa có kịch bản tương ứng</p>
            <p className="text-[11px] text-muted-foreground/70">
              Vui lòng cấu hình bổ sung loại này trong tab Quản lý.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ScenarioResultCards({
  outcome,
  onActivateType,
  isActivating,
}: ScenarioResultCardsProps): JSX.Element {
  const isZeroRain = outcome.inputRainfall <= 0
  const isAllNoFlood =
    outcome.hienTrang.status === 'no_flood' &&
    outcome.caiTao.status === 'no_flood' &&
    outcome.quyHoachRcp45.status === 'no_flood' &&
    outcome.quyHoachRcp85.status === 'no_flood'

  return (
    <div className="space-y-3 pt-2">
      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
        <div className="font-semibold text-foreground flex items-center gap-2">
          {isZeroRain ? (
            <>
              <Sun className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Kết quả tra cứu cho mức mưa 0 mm/h (Không mưa — Không kích hoạt kịch bản ngập)</span>
            </>
          ) : isAllNoFlood ? (
            <>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                Kết quả tra cứu cho mức mưa {outcome.inputRainfall} mm/h (Lượng mưa an toàn — Dưới ngưỡng gây ngập úng)
              </span>
            </>
          ) : (
            <>
              <CloudRain className="size-4 text-primary" />
              <span>Kết quả tra cứu đồng thời cho mức mưa {outcome.inputRainfall} mm/h</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Hiện trạng */}
        <SingleTypeCard
          match={outcome.hienTrang}
          onActivate={onActivateType ? () => onActivateType(outcome.hienTrang) : undefined}
          isActivating={isActivating}
        />

        {/* 2. Cải tạo thoát nước */}
        <SingleTypeCard
          match={outcome.caiTao}
          onActivate={onActivateType ? () => onActivateType(outcome.caiTao) : undefined}
          isActivating={isActivating}
        />

        {/* 3. Quy hoạch 2050 (Hiển thị RCP 4.5 & 8.5) */}
        <div className="space-y-4">
          <SingleTypeCard
            match={outcome.quyHoachRcp45}
            onActivate={onActivateType ? () => onActivateType(outcome.quyHoachRcp45) : undefined}
            isActivating={isActivating}
          />
          <SingleTypeCard
            match={outcome.quyHoachRcp85}
            onActivate={onActivateType ? () => onActivateType(outcome.quyHoachRcp85) : undefined}
            isActivating={isActivating}
          />
        </div>
      </div>
    </div>
  )
}
