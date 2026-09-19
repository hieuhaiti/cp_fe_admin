import { useState, type JSX } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Pen, Layers, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ScenarioDraftItem, ScenarioGroupRow } from './types'
import { SCENARIO_TYPES, type RcpOptionId } from './constants'

interface ScenarioGroupTableProps {
  groups: ScenarioGroupRow[]
  onEditScenario: (item: ScenarioDraftItem) => void
  canEdit?: boolean
}

function ScenarioCell({
  item,
  onEdit,
  canEdit,
  typeTitle,
}: {
  item: ScenarioDraftItem | null
  onEdit: (i: ScenarioDraftItem) => void
  canEdit?: boolean
  typeTitle: string
}): JSX.Element {
  if (!item) {
    return (
      <div className="scenario-matrix-cell empty">
        <span className="flex items-center gap-1 text-xs">
          <AlertCircle className="size-3.5" /> Chưa cấu hình
        </span>
      </div>
    )
  }

  return (
    <div className="scenario-matrix-cell group transition-all hover:shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <div>
          <span className="font-mono text-xs font-bold text-foreground">{item.code}</span>
          {item.rcp && (
            <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
              {item.rcp === 'rcp45' ? 'RCP 4.5' : 'RCP 8.5'}
            </Badge>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[11px] ${
            item.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          }`}
        >
          {item.isActive ? (
            <>
              <CheckCircle2 className="size-3" /> Hoạt động
            </>
          ) : (
            'Vô hiệu'
          )}
        </span>
      </div>

      <p className="line-clamp-1 text-xs text-muted-foreground" title={item.nameVi}>
        {item.nameVi}
      </p>

      <div className="mt-1 flex items-center justify-between border-t pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 truncate font-mono text-[10px]" title={item.layerCode}>
          <Layers className="size-3 shrink-0" />
          {item.layerCode}
        </span>
        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(item)
                }}
                aria-label={`Chỉnh sửa ${typeTitle} (${item.code})`}
                className="opacity-80 group-hover:opacity-100"
              >
                <Pen className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{`Chỉnh sửa ${typeTitle} (${item.code})`}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default function ScenarioGroupTable({
  groups,
  onEditScenario,
  canEdit = true,
}: ScenarioGroupTableProps): JSX.Element {
  const [selectedRcpView, setSelectedRcpView] = useState<RcpOptionId>('rcp45')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Nhánh kịch bản Quy hoạch 2050:</span>
          <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedRcpView('rcp45')}
              className={`rounded px-2 py-0.5 font-medium transition-all ${
                selectedRcpView === 'rcp45'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Kịch bản RCP 4.5
            </button>
            <button
              type="button"
              onClick={() => setSelectedRcpView('rcp85')}
              className={`rounded px-2 py-0.5 font-medium transition-all ${
                selectedRcpView === 'rcp85'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Kịch bản RCP 8.5
            </button>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          Hiển thị đồng thời 3 loại kịch bản ngập tương ứng từng điều kiện mưa
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-48">Điều kiện Mưa & Triều</TableHead>
              <TableHead className="min-w-[200px]">
                <div className="flex items-center gap-1.5">
                  <span className="scenario-type-badge hien_trang">
                    {SCENARIO_TYPES.hien_trang.label}
                  </span>
                </div>
              </TableHead>
              <TableHead className="min-w-[200px]">
                <div className="flex items-center gap-1.5">
                  <span className="scenario-type-badge cai_tao">
                    {SCENARIO_TYPES.cai_tao.label}
                  </span>
                </div>
              </TableHead>
              <TableHead className="min-w-[220px]">
                <div className="flex items-center gap-1.5">
                  <span className="scenario-type-badge quy_hoach">
                    {SCENARIO_TYPES.quy_hoach.label} ({selectedRcpView === 'rcp45' ? 'RCP 4.5' : 'RCP 8.5'})
                  </span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Chưa có bộ kịch bản nào được cấu hình.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const qhItem =
                  selectedRcpView === 'rcp45' ? group.quyHoachRcp45 : group.quyHoachRcp85

                return (
                  <TableRow key={group.groupKey} className="align-top hover:bg-muted/20">
                    <TableCell className="space-y-1">
                      <div className="font-semibold text-foreground text-sm">{group.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Mưa: <span className="font-medium text-foreground">{group.rainfallDisplay}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Mực triều: <span className="font-medium text-foreground">{group.tideDisplay}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <ScenarioCell
                        item={group.hienTrang}
                        onEdit={onEditScenario}
                        canEdit={canEdit}
                        typeTitle={SCENARIO_TYPES.hien_trang.label}
                      />
                    </TableCell>

                    <TableCell>
                      <ScenarioCell
                        item={group.caiTao}
                        onEdit={onEditScenario}
                        canEdit={canEdit}
                        typeTitle={SCENARIO_TYPES.cai_tao.label}
                      />
                    </TableCell>

                    <TableCell>
                      <ScenarioCell
                        item={qhItem}
                        onEdit={onEditScenario}
                        canEdit={canEdit}
                        typeTitle={`${SCENARIO_TYPES.quy_hoach.label} (${selectedRcpView === 'rcp45' ? 'RCP 4.5' : 'RCP 8.5'})`}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
