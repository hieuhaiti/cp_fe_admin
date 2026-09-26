import {
  RCP_OPTIONS,
  SCENARIO_TYPES,
  type ScenarioTypeId,
  type RcpOptionId,
} from './constants'
import type {
  ScenarioDraftItem,
  ScenarioGroupRow,
  ThreeTypeSimulationOutcome,
  TypeSimulationMatch,
} from './types'
import type { FloodScenario } from '@/service/kttvScenarioService'

/**
 * Chuyển đổi bản ghi kịch bản thật từ API/DB thành ScenarioDraftItem
 */
export function scenarioFromDb(s: FloodScenario): ScenarioDraftItem {
  const inferred = inferScenarioType(s)
  const resolvedType = s.type || inferred.type || 'hien_trang'
  const resolvedRcp = s.rcp || (resolvedType === 'quy_hoach' ? inferred.rcp || 'rcp45' : undefined)

  return {
    id: s.id,
    code: s.code,
    nameVi: s.name_vi,
    type: resolvedType,
    rcp: resolvedRcp,
    minRainfall: s.min_rainfall != null ? Number(s.min_rainfall) : null,
    maxRainfall: s.max_rainfall != null ? Number(s.max_rainfall) : null,
    minTide: s.min_tide != null ? Number(s.min_tide) : null,
    maxTide: s.max_tide != null ? Number(s.max_tide) : null,
    layerCode: s.layer_code,
    layerName: s.layer?.nameVi || s.name_vi,
    description: s.description,
    isActive: s.is_active,
  }
}

/**
 * Phân tích nhận diện loại kịch bản từ tên, mã hoặc trường phân loại thực tế
 */
export function inferScenarioType(item: {
  type?: ScenarioTypeId | null
  rcp?: RcpOptionId | null
  code?: string
  name_vi?: string
  nameVi?: string
  layer_code?: string
  layerCode?: string
  description?: string | null
}): { type: ScenarioTypeId | null; rcp?: RcpOptionId } {
  if (item.type) {
    return { type: item.type, rcp: item.rcp ?? undefined }
  }

  const marker = String(item.description || '').match(
    /^\[\[scenario:(hien_trang|cai_tao|quy_hoach)(?:;rcp:(rcp45|rcp85))?\]\]/i
  )
  if (marker) {
    return {
      type: marker[1].toLowerCase() as ScenarioTypeId,
      rcp: (marker[2]?.toLowerCase() as RcpOptionId) || undefined,
    }
  }

  const text = `${item.code ?? ''} ${item.name_vi ?? item.nameVi ?? ''} ${item.layer_code ?? item.layerCode ?? ''} ${item.description ?? ''}`.toLowerCase()

  if (text.includes('quy hoạch') || text.includes('quy hoach') || text.includes('2050')) {
    const rcp: RcpOptionId | undefined = text.includes('8.5') || text.includes('85')
      ? 'rcp85'
      : text.includes('4.5') || text.includes('45')
      ? 'rcp45'
      : undefined
    return { type: 'quy_hoach', rcp }
  }

  if (text.includes('cải tạo') || text.includes('cai tao') || text.includes('thoát nước')) {
    return { type: 'cai_tao' }
  }

  if (text.includes('hiện trạng') || text.includes('hien trang')) {
    return { type: 'hien_trang' }
  }

  return { type: null }
}

/**
 * Nhóm danh sách các kịch bản theo tần suất / điều kiện mưa để tạo thành các dòng hiển thị 3 cột
 */
export function groupScenariosByRainCondition(items: ScenarioDraftItem[]): ScenarioGroupRow[] {
  // Lấy các tần suất chuẩn: 1%, 2%, 5%, 10%, 20%, 50%
  const frequencies = ['1%', '2%', '5%', '10%', '20%', '50%']

  const groups: ScenarioGroupRow[] = frequencies.map((freq) => {
    const ht = items.find((i) => i.type === 'hien_trang' && i.frequency === freq) ?? null
    const ct = items.find((i) => i.type === 'cai_tao' && i.frequency === freq) ?? null
    const qh45 =
      items.find((i) => i.type === 'quy_hoach' && i.rcp === 'rcp45' && i.frequency === freq) ?? null
    const qh85 =
      items.find((i) => i.type === 'quy_hoach' && i.rcp === 'rcp85' && i.frequency === freq) ?? null

    const refItem = ht ?? ct ?? qh45 ?? qh85

    const rainfallDisplay = refItem
      ? refItem.maxRainfall != null
        ? `${refItem.minRainfall ?? 0} – ${refItem.maxRainfall} mm`
        : `≥ ${refItem.minRainfall ?? 0} mm`
      : 'Theo tần suất'

    const tideDisplay = refItem?.minTide != null ? `${refItem.minTide} m` : '0.837 m'

    return {
      groupKey: `freq_${freq}`,
      title: `Kịch bản mưa tần suất ${freq}`,
      frequency: freq,
      rainfallDisplay,
      tideDisplay,
      hienTrang: ht,
      caiTao: ct,
      quyHoachRcp45: qh45,
      quyHoachRcp85: qh85,
    }
  })

  // Thêm các kịch bản tùy biến hoặc không có tần suất chuẩn vào các nhóm bổ sung
  const otherItems = items.filter((i) => !i.frequency || !frequencies.includes(i.frequency))
  if (otherItems.length > 0) {
    groups.push({
      groupKey: 'custom_scenarios',
      title: 'Kịch bản khác / Bản ghi tùy chỉnh',
      frequency: 'Tùy chỉnh',
      rainfallDisplay: 'Nhiều ngưỡng',
      tideDisplay: '—',
      hienTrang: otherItems.find((i) => i.type === 'hien_trang') ?? null,
      caiTao: otherItems.find((i) => i.type === 'cai_tao') ?? null,
      quyHoachRcp45:
        otherItems.find((i) => i.type === 'quy_hoach' && i.rcp === 'rcp45') ?? null,
      quyHoachRcp85:
        otherItems.find((i) => i.type === 'quy_hoach' && i.rcp === 'rcp85') ?? null,
    })
  }

  return groups
}

/**
 * Tra cứu mô phỏng cho 3 loại kịch bản ứng với 1 mức mưa nhập vào
 */
export function simulateThreeTypesFromList(
  items: ScenarioDraftItem[],
  rainfall: number,
  tide: number | null = null,
  durationKey: string = '1h'
): ThreeTypeSimulationOutcome {
  function matchForSubset(
    type: ScenarioTypeId,
    rcp?: RcpOptionId
  ): TypeSimulationMatch {
    const typeOption = SCENARIO_TYPES[type]
    const candidates = items.filter((item) => {
      if (item.type !== type) return false
      if (rcp && item.rcp !== rcp) return false
      return true
    })

    if (rainfall <= 0) {
      return {
        type,
        typeLabel: typeOption.label,
        rcp,
        rcpLabel: rcp ? RCP_OPTIONS[rcp].label : undefined,
        status: 'no_rain',
        scenario: null,
      }
    }

    if (candidates.length === 0) {
      return {
        type,
        typeLabel: typeOption.label,
        rcp,
        rcpLabel: rcp ? RCP_OPTIONS[rcp].label : undefined,
        status: 'unconfigured',
        scenario: null,
      }
    }

    // Tìm kịch bản thỏa mãn rainfall >= minRainfall và (maxRainfall is null hoặc rainfall <= maxRainfall)
    let best = candidates.find((item) => {
      const min = item.minRainfall ?? 0
      const max = item.maxRainfall
      if (rainfall < min) return false
      if (max != null && rainfall > max) return false
      return true
    })

    // Nếu không khớp khoảng chính xác, nếu lượng mưa vượt ngưỡng cao nhất thì chọn kịch bản cao nhất
    if (!best) {
      const lower = candidates
        .filter((c) => (c.minRainfall ?? 0) <= rainfall)
        .sort((a, b) => (b.minRainfall ?? 0) - (a.minRainfall ?? 0))
      if (lower.length > 0) {
        best = lower[0]
      }
      // Nếu rainfall nhỏ hơn tất cả minRainfall (ví dụ 0.38 < 29.10),
      // không fallback ép chọn kịch bản thấp nhất, mà lượng mưa này là an toàn (không ngập).
    }

    if (!best) {
      return {
        type,
        typeLabel: typeOption.label,
        rcp,
        rcpLabel: rcp ? RCP_OPTIONS[rcp].label : undefined,
        status: 'no_flood',
        scenario: null,
      }
    }

    return {
      type,
      typeLabel: typeOption.label,
      rcp,
      rcpLabel: rcp ? RCP_OPTIONS[rcp].label : undefined,
      status: 'matched',
      scenario: best,
      layerCode: best.layerCode,
      layerName: best.nameVi,
    }
  }

  return {
    inputRainfall: rainfall,
    inputTide: tide,
    selectedDuration: durationKey,
    hienTrang: matchForSubset('hien_trang'),
    caiTao: matchForSubset('cai_tao'),
    quyHoachRcp45: matchForSubset('quy_hoach', 'rcp45'),
    quyHoachRcp85: matchForSubset('quy_hoach', 'rcp85'),
  }
}

/**
 * Format dải lượng mưa thân thiện với người dùng
 */
export function formatRainfallRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return 'Không giới hạn'
  if (min == null) return `≤ ${max} mm`
  if (max == null) return `≥ ${min} mm`
  return `${min} – ${max} mm`
}
