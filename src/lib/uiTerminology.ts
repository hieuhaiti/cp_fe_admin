/**
 * Quản lý chuẩn hóa ngôn ngữ giao diện người dùng (UI Terminology).
 * Chuyển đổi các thuật ngữ hạ tầng kỹ thuật nội bộ, tên cột DB và mã trạng thái máy chủ
 * sang ngôn ngữ tiếng Việt nghiệp vụ chuẩn hóa, phục vụ cán bộ và người dùng cuối.
 */

const INFRASTRUCTURE_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Google\s+Earth\s+Engine/gi, 'hệ thống xử lý viễn thám'],
  [/\bGEE\b/g, 'hệ thống xử lý viễn thám'],
  [/\bGeoServer\b/gi, 'hệ thống bản đồ'],
  [/\bMapProxy\b/gi, 'dịch vụ bản đồ'],
  [/\bMapServer\b/gi, 'dịch vụ bản đồ'],
  [/\bMinIO\b/gi, 'kho lưu trữ dữ liệu'],
  [/\bcoverage_key\b/gi, 'nhóm chuỗi thời gian'],
  [/\bcoverageKey\b/g, 'nhóm chuỗi thời gian'],
  [/\bWMS\b/g, 'dịch vụ bản đồ'],
  [/\bWFS\b/g, 'dịch vụ dữ liệu vector'],
  [/\bWCS\b/g, 'dịch vụ tải dữ liệu'],
  [/\bCOG\b/g, 'dữ liệu bản đồ tối ưu'],
  [/\bGeoTIFF\b/g, 'ảnh viễn thám'],
]

const ERROR_CODE_TRANSLATIONS: Record<string, string> = {
  RASTER_LAYER_CONFLICT: 'Mã lớp bản đồ bị trùng lặp',
  LAYER_CODE_RETIRED: 'Mã lớp đã từng được sử dụng trước đây; vui lòng chọn mã lớp mới',
  LAYER_CODE_IN_USE_BY_OTHER_IMAGE: 'Mã lớp đang được sử dụng bởi ảnh viễn thám khác',
  GEE_DOWNLOAD_URL_STALE: 'Liên kết tải ảnh đã hết hiệu lực; vui lòng làm mới',
  SOURCE_IMAGE_IN_USE: 'Ảnh nguồn đang được liên kết trong lớp bản đồ; không thể xóa trực tiếp',
  CLEANUP_IN_PROGRESS: 'Hệ thống đang thực hiện giải phóng tài nguyên',
}

const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  none: 'Chưa khởi tạo',
  queued: 'Đang chờ xử lý',
  running: 'Đang xử lý',
  complete: 'Đã hoàn tất',
  completed: 'Đã hoàn tất',
  failed: 'Dọn dẹp thất bại',
  cleanup_pending: 'Đang dọn dẹp lớp',
  cleanup_failed: 'Dọn dẹp thất bại',
  active: 'Đang hoạt động',
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  published: 'Đã xuất bản',
  unpublished: 'Chưa xuất bản',
}

const MODEL_STATUS_LABELS: Record<string, string> = {
  SUCCEEDED: 'Mô hình hoàn tất',
  succeeded: 'Mô hình hoàn tất',
  FAILED: 'Mô hình thất bại',
  failed: 'Mô hình thất bại',
  RUNNING: 'Đang chạy mô hình',
  running: 'Đang chạy mô hình',
  PENDING: 'Chờ thực thi',
  pending: 'Chờ thực thi',
}

/**
 * Làm sạch chuỗi thông báo từ API, thay thế các từ ngữ hạ tầng hoặc mã kỹ thuật nội bộ
 * bằng câu từ nghiệp vụ dễ hiểu.
 */
export function neutralizeUiMessage(value: unknown): string {
  if (typeof value !== 'string') return ''
  let text = value.trim()
  if (!text) return ''

  // 1. Dịch mã lỗi UPPER_SNAKE_CASE nếu toàn bộ message là mã lỗi
  if (ERROR_CODE_TRANSLATIONS[text]) {
    return ERROR_CODE_TRANSLATIONS[text]
  }

  // 2. Thay thế mã lỗi nhúng trong văn bản
  for (const [code, translation] of Object.entries(ERROR_CODE_TRANSLATIONS)) {
    if (text.includes(code)) {
      text = text.replace(new RegExp(`\\b${code}\\b`, 'g'), translation)
    }
  }

  // 3. Thay thế các danh từ hạ tầng
  for (const [pattern, replacement] of INFRASTRUCTURE_TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }

  return text
}

/**
 * Chuyển đổi mã trạng thái tiến trình dọn dẹp hoặc vòng đời lớp dữ liệu sang tiếng Việt.
 */
export function formatLifecycleStatus(status?: string | null): string {
  if (!status) return ''
  return LIFECYCLE_STATUS_LABELS[status] || status
}

/**
 * Chuyển đổi mã trạng thái mô hình phân tích / tính toán sang tiếng Việt.
 */
export function formatModelStatus(status?: string | null): string {
  if (!status) return ''
  return MODEL_STATUS_LABELS[status] || status
}
