// ── Active status ─────────────────────────────────────────────────
export const ACTIVE_LABEL: Record<string, string> = {
  true: 'Đang hoạt động',
  false: 'Ngừng hoạt động',
}
export const ACTIVE_CLASS: Record<string, string> = {
  true: 'bg-green-50 text-green-700 border-green-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const ACTIVE_DOT: Record<string, string> = {
  true: 'bg-green-500',
  false: 'bg-slate-400',
}

// ── Published status ──────────────────────────────────────────────
export const PUBLISHED_LABEL: Record<string, string> = {
  true: 'Đã xuất bản',
  false: 'Bản nháp',
}
export const PUBLISHED_CLASS: Record<string, string> = {
  true: 'bg-sky-50 text-sky-700 border-sky-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLISHED_DOT: Record<string, string> = {
  true: 'bg-sky-500',
  false: 'bg-slate-400',
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
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLIC_DOT: Record<string, string> = {
  true: 'bg-emerald-500',
  false: 'bg-slate-400',
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


