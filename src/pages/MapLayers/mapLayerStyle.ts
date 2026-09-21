import type { GeometryType, MapLayerDefaultStyle } from '@/types/api/mapLayer'

export type StyleInputType = 'color' | 'number' | 'select' | 'boolean' | 'dasharray'

export interface StylePropertyDefinition {
  key: string
  label: string
  type: StyleInputType
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
  description?: string
  placeholder?: string
}

const COMMON_DEFINITIONS: StylePropertyDefinition[] = [
  {
    key: 'opacity',
    label: 'Độ mờ tổng thể (opacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    description: 'Giá trị từ 0 (trong suốt) đến 1 (rõ nét)',
  },
  // {
  //   key: 'visible_by_default',
  //   label: 'Hiển thị trên bản đồ mặc định',
  //   type: 'boolean',
  //   description: 'Chọn để lớp này tự động mở khi vào trang bản đồ',
  // },
]

const POLYGON_DEFINITIONS: StylePropertyDefinition[] = [
  {
    key: 'fillColor',
    label: 'Màu tô (fillColor)',
    type: 'color',
    placeholder: '#3388FF',
    description: 'Màu nền của vùng polygon (mã HEX)',
  },
  {
    key: 'fillOpacity',
    label: 'Độ mờ tô (fillOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '0.6',
    description: 'Độ trong suốt của màu nền polygon (0 - 1)',
  },
  {
    key: 'strokeColor',
    label: 'Màu viền (strokeColor)',
    type: 'color',
    placeholder: '#0055AA',
    description: 'Màu đường bao viền ngoài (mã HEX)',
  },
  {
    key: 'strokeOpacity',
    label: 'Độ mờ viền (strokeOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '1',
    description: 'Độ trong suốt của đường viền (0 - 1)',
  },
  {
    key: 'strokeWidth',
    label: 'Độ rộng viền (strokeWidth)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '2',
    description: 'Độ dày đường viền (pixel)',
  },
  {
    key: 'strokeDasharray',
    label: 'Kiểu nét đứt viền (strokeDasharray)',
    type: 'dasharray',
    placeholder: '2, 4',
    description: 'Độ dài đoạn gạch và khoảng trống (ví dụ: 2, 4)',
  },
  {
    key: 'strokeBlur',
    label: 'Độ mờ nhòe viền (strokeBlur)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '0',
    description: 'Độ nhòe mép đường viền (pixel)',
  },
  {
    key: 'fillAntialias',
    label: 'Khử răng cưa (fillAntialias)',
    type: 'boolean',
    description: 'Khử răng cưa cho cạnh polygon',
  },
  ...COMMON_DEFINITIONS,
]

const LINE_DEFINITIONS: StylePropertyDefinition[] = [
  {
    key: 'strokeColor',
    label: 'Màu đường (strokeColor)',
    type: 'color',
    placeholder: '#FF3300',
    description: 'Màu của đường (mã HEX)',
  },
  {
    key: 'strokeOpacity',
    label: 'Độ mờ đường (strokeOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '1',
    description: 'Độ trong suốt của đường (0 - 1)',
  },
  {
    key: 'strokeWidth',
    label: 'Độ rộng đường (strokeWidth)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '3',
    description: 'Độ dày của đường (pixel)',
  },
  {
    key: 'strokeBlur',
    label: 'Độ mờ nhòe (strokeBlur)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '0',
    description: 'Độ nhòe cạnh đường (pixel)',
  },
  {
    key: 'strokeOffset',
    label: 'Độ lệch tim đường (strokeOffset)',
    type: 'number',
    placeholder: '0',
    description: 'Khoảng cách lệch khỏi tim đường (pixel)',
  },
  {
    key: 'strokeDasharray',
    label: 'Kiểu nét đứt (strokeDasharray)',
    type: 'dasharray',
    placeholder: '4, 4',
    description: 'Độ dài đoạn nét và khoảng trống (ví dụ: 4, 4)',
  },
  {
    key: 'lineCap',
    label: 'Đầu mút đường (lineCap)',
    type: 'select',
    options: [
      { value: 'butt', label: 'Cắt vuông (butt)' },
      { value: 'round', label: 'Bo tròn (round)' },
      { value: 'square', label: 'Vuông dài (square)' },
    ],
  },
  {
    key: 'lineJoin',
    label: 'Góc nối đường (lineJoin)',
    type: 'select',
    options: [
      { value: 'miter', label: 'Góc nhọn (miter)' },
      { value: 'round', label: 'Bo tròn (round)' },
      { value: 'bevel', label: 'Vát góc (bevel)' },
    ],
  },
  ...COMMON_DEFINITIONS,
]

const POINT_DEFINITIONS: StylePropertyDefinition[] = [
  {
    key: 'circleColor',
    label: 'Màu điểm (circleColor)',
    type: 'color',
    placeholder: '#0F766E',
    description: 'Màu hình tròn điểm (mã HEX)',
  },
  {
    key: 'circleOpacity',
    label: 'Độ mờ điểm (circleOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '1',
    description: 'Độ trong suốt của điểm (0 - 1)',
  },
  {
    key: 'circleRadius',
    label: 'Bán kính điểm (circleRadius)',
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    placeholder: '6',
    description: 'Bán kính hình tròn (pixel)',
  },
  {
    key: 'circleBlur',
    label: 'Độ nhòe điểm (circleBlur)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '0',
    description: 'Độ nhòe viền điểm (pixel)',
  },
  {
    key: 'circleStrokeColor',
    label: 'Màu viền điểm (circleStrokeColor)',
    type: 'color',
    placeholder: '#FFFFFF',
    description: 'Màu viền xung quanh điểm (mã HEX)',
  },
  {
    key: 'circleStrokeOpacity',
    label: 'Độ mờ viền điểm (circleStrokeOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '1',
    description: 'Độ trong suốt viền điểm (0 - 1)',
  },
  {
    key: 'circleStrokeWidth',
    label: 'Độ rộng viền điểm (circleStrokeWidth)',
    type: 'number',
    min: 0,
    max: 50,
    step: 1,
    placeholder: '2',
    description: 'Độ dày viền điểm (pixel)',
  },
  ...COMMON_DEFINITIONS,
]

const RASTER_DEFINITIONS: StylePropertyDefinition[] = [
  {
    key: 'rasterOpacity',
    label: 'Độ mờ ảnh (rasterOpacity)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '0.85',
    description: 'Độ trong suốt của lớp raster ảnh (0 - 1)',
  },
  {
    key: 'brightnessMin',
    label: 'Độ sáng tối thiểu (brightnessMin)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '0',
    description: 'Giới hạn độ sáng dưới (0 - 1)',
  },
  {
    key: 'brightnessMax',
    label: 'Độ sáng tối đa (brightnessMax)',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    placeholder: '1',
    description: 'Giới hạn độ sáng trên (0 - 1)',
  },
  {
    key: 'contrast',
    label: 'Độ tương phản (contrast)',
    type: 'number',
    min: -1,
    max: 1,
    step: 0.05,
    placeholder: '0',
    description: 'Tăng giảm tương phản (-1 đến 1)',
  },
  {
    key: 'saturation',
    label: 'Độ bão hòa màu (saturation)',
    type: 'number',
    min: -1,
    max: 1,
    step: 0.05,
    placeholder: '0',
    description: 'Tăng giảm bão hòa màu (-1 đến 1)',
  },
  {
    key: 'hueRotate',
    label: 'Xoay góc sắc độ (hueRotate)',
    type: 'number',
    min: 0,
    max: 360,
    step: 1,
    placeholder: '0',
    description: 'Góc xoay sắc thái màu (0 - 360 độ)',
  },
  {
    key: 'fadeDuration',
    label: 'Thời gian chuyển ảnh (fadeDuration)',
    type: 'number',
    min: 0,
    max: 10000,
    step: 100,
    placeholder: '300',
    description: 'Thời gian làm mờ khi tải tile mới (ms)',
  },
  {
    key: 'resampling',
    label: 'Thuật toán tái lấy mẫu (resampling)',
    type: 'select',
    options: [
      { value: 'linear', label: 'Tuyến tính mịn (linear)' },
      { value: 'nearest', label: 'Lân cận gần nhất (nearest)' },
    ],
  },
  ...COMMON_DEFINITIONS,
]

export function normalizeGeometryCategory(
  geometryType: GeometryType | string | null | undefined
): 'polygon' | 'line' | 'point' | 'raster' | 'other' {
  if (!geometryType) return 'other'
  const normalized = String(geometryType).toUpperCase().trim()
  if (normalized.includes('POLYGON')) return 'polygon'
  if (normalized.includes('LINE')) return 'line'
  if (normalized.includes('POINT')) return 'point'
  if (normalized.includes('RASTER') || normalized.includes('GEOTIFF')) return 'raster'
  return 'other'
}

export function getStyleDefinitions(
  geometryType: GeometryType | string | null | undefined
): StylePropertyDefinition[] {
  const category = normalizeGeometryCategory(geometryType)
  switch (category) {
    case 'polygon':
      return POLYGON_DEFINITIONS
    case 'line':
      return LINE_DEFINITIONS
    case 'point':
      return POINT_DEFINITIONS
    case 'raster':
      return RASTER_DEFINITIONS
    default:
      return [...POLYGON_DEFINITIONS, ...LINE_DEFINITIONS, ...POINT_DEFINITIONS, ...RASTER_DEFINITIONS]
        .filter((def, index, self) => self.findIndex((d) => d.key === def.key) === index)
  }
}

export function stringifyStyle(style: MapLayerDefaultStyle | null | undefined): string {
  if (!style || Object.keys(style).length === 0) return ''
  return JSON.stringify(style, null, 2)
}

export function parseStyleJson(
  rawJson: string
): { style: MapLayerDefaultStyle | null; error?: string } {
  const trimmed = rawJson.trim()
  if (!trimmed) return { style: null }
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { style: null, error: 'Cấu hình kiểu vẽ phải là một đối tượng JSON hợp lệ {}.' }
    }
    return { style: parsed as MapLayerDefaultStyle }
  } catch (err) {
    return {
      style: null,
      error: `JSON không hợp lệ: ${err instanceof Error ? err.message : 'Lỗi cú pháp'}`,
    }
  }
}

export function cleanStyleObject(
  style: Record<string, unknown> | null | undefined
): MapLayerDefaultStyle | null {
  if (!style || typeof style !== 'object') return null
  const entries = Object.entries(style).filter(([, val]) => {
    if (val === undefined || val === null || val === '') return false
    return true
  })
  if (entries.length === 0) return null
  return Object.fromEntries(entries) as MapLayerDefaultStyle
}
