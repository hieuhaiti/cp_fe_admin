export type ScenarioTypeId = 'hien_trang' | 'cai_tao' | 'quy_hoach'
export type RcpOptionId = 'rcp45' | 'rcp85'

export interface ScenarioTypeOption {
  id: ScenarioTypeId
  label: string
  shortLabel: string
  description: string
  color: string
}

export const SCENARIO_TYPES: Record<ScenarioTypeId, ScenarioTypeOption> = {
  hien_trang: {
    id: 'hien_trang',
    label: 'Hiện trạng ngập lụt',
    shortLabel: 'Hiện trạng',
    description: 'Đánh giá nguy cơ ngập lụt theo hiện trạng hạ tầng đô thị hiện hữu',
    color: 'hsl(var(--primary))',
  },
  cai_tao: {
    id: 'cai_tao',
    label: 'Cải tạo thoát nước',
    shortLabel: 'Cải tạo',
    description: 'Mô phỏng hiệu quả sau khi nâng cấp hệ thống cống và trạm bơm thoát nước',
    color: 'hsl(var(--success))',
  },
  quy_hoach: {
    id: 'quy_hoach',
    label: 'Quy hoạch 2050',
    shortLabel: 'Quy hoạch 2050',
    description: 'Dự báo ngập lụt tầm nhìn 2050 theo kịch bản biến đổi khí hậu và nước biển dâng',
    color: 'hsl(var(--warning))',
  },
}

export const SCENARIO_TYPE_LIST: ScenarioTypeOption[] = [
  SCENARIO_TYPES.hien_trang,
  SCENARIO_TYPES.cai_tao,
  SCENARIO_TYPES.quy_hoach,
]

export interface RcpOption {
  id: RcpOptionId
  label: string
  name: string
  description: string
}

export const RCP_OPTIONS: Record<RcpOptionId, RcpOption> = {
  rcp45: {
    id: 'rcp45',
    label: 'RCP 4.5',
    name: 'Kịch bản phát thải trung bình (RCP 4.5)',
    description: 'Mực nước triều tính toán +1.041 m vào năm 2050',
  },
  rcp85: {
    id: 'rcp85',
    label: 'RCP 8.5',
    name: 'Kịch bản phát thải cao (RCP 8.5)',
    description: 'Mực nước triều tính toán +1.041 m vào năm 2050, lượng mưa cực đoan tăng mạnh',
  },
}

export const RCP_OPTION_LIST: RcpOption[] = [
  RCP_OPTIONS.rcp45,
  RCP_OPTIONS.rcp85,
]

export const DURATION_OPTIONS = [
  { id: '1h', label: '1 giờ (1h)' },
  { id: '3h', label: '3 giờ (3h)' },
  { id: '6h', label: '6 giờ (6h)' },
  { id: '12h', label: '12 giờ (12h)' },
  { id: '24h', label: '24 giờ (24h)' },
] as const

export type RainDuration = (typeof DURATION_OPTIONS)[number]['id']
