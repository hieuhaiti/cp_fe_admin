import { STATUS_DOT_BADGE_STYLES } from '@/lib/statusBadgeStyles'
export const GEOMETRY_TYPE_LABEL: Record<string, string> = {
  POINT: 'Dữ liệu điểm',
  MULTIPOINT: 'Dữ liệu đa điểm',
  LINE: 'Dữ liệu đường',
  LINESTRING: 'Dữ liệu đường',
  MULTILINESTRING: 'Dữ liệu đa đường',
  POLYGON: 'Dữ liệu vùng',
  MULTIPOLYGON: 'Dữ liệu đa vùng',
  GEOMETRY: 'Dữ liệu hình học',
  RASTER: 'Ảnh bản đồ',
}

// ── Active status ─────────────────────────────────────────────────
export const ACTIVE_LABEL: Record<string, string> = {
  true: 'Đang hoạt động',
  false: 'Ngừng hoạt động',
}
export const ACTIVE_CLASS: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.success.badge,
  false: STATUS_DOT_BADGE_STYLES.neutral.badge,
}
export const ACTIVE_DOT: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.success.dot,
  false: STATUS_DOT_BADGE_STYLES.neutral.dot,
}

// ── Published status ──────────────────────────────────────────────
export const PUBLISHED_LABEL: Record<string, string> = {
  true: 'Đã xuất bản',
  false: 'Bản nháp',
}
export const PUBLISHED_CLASS: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.info.badge,
  false: STATUS_DOT_BADGE_STYLES.neutral.badge,
}
export const PUBLISHED_DOT: Record<string, string> = {
  true: STATUS_DOT_BADGE_STYLES.info.dot,
  false: STATUS_DOT_BADGE_STYLES.neutral.dot,
}

// ── Role label mapping ────────────────────────────────────────────
export const ROLE_LABEL_MAP: Record<string, string> = {
  system_admin: 'Quản trị hệ thống',
  ubnd_tp: 'UBND TP Cẩm Phả',
  so_tnmt: 'Sở Tài nguyên & Môi trường',
  so_xd: 'Sở Xây dựng',
  citizen: 'Người dân',
}

// ── Public status ─────────────────────────────────────────────────
export const PUBLIC_LABEL: Record<string, string> = {
  true: 'Công khai',
  false: 'Riêng tư',
}
export const PUBLIC_CLASS: Record<string, string> = {
  true: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  false: STATUS_DOT_BADGE_STYLES.neutral.badge,
}
export const PUBLIC_DOT: Record<string, string> = {
  true: 'bg-emerald-500',
  false: STATUS_DOT_BADGE_STYLES.neutral.dot,
}

// ── Category (nhóm lớp) ───────────────────────────────────────────
// Không dùng danh mục fix cứng. Toàn bộ danh mục lớp được lấy động từ
// API GET /api/v1/admin/layers/categories thông qua hook useLayerCategories.
/**
 * @deprecated Không sử dụng danh mục fix cứng. Danh mục lấy động từ API.
 */
export const MAP_LAYER_CATEGORY_LABEL_VI: Record<string, string> = {
  land_cover: 'Lớp phủ mặt đất',
  remote_sensing: 'Ảnh viễn thám',
  flood: 'Ngập lụt và thủy văn',
  forest_district: 'Phân loại đối tượng theo huyện',
  hanh_chinh: 'Hành chính',
  thuy_van: 'Thủy văn',
  giao_thong: 'Giao thông',
  other: 'Khác',
}

/**
 * @deprecated Không sử dụng danh mục fix cứng. Danh mục lấy động từ API.
 */
export const MAP_LAYER_CATEGORY_OPTIONS: { value: string; label: string }[] = []

export function getMapLayerCategoryLabel(key?: string | null): string {
  if (!key) return '-'
  return (
    MAP_LAYER_CATEGORY_LABEL_VI[key] ||
    key
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function toCategorySlug(value: string): string {
  if (!value || !value.trim()) return ''
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  if (!normalized) return ''
  return /^[a-z]/.test(normalized) ? normalized : `cat_${normalized}`
}


