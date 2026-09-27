import { z } from 'zod'
import type { CreateMapLayerApiBody, UpdateMapLayerApiBody } from '@/types/api'

export const createMapLayerApiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Tên gợi nhớ phải có ít nhất 3 ký tự')
    .max(150, 'Tên gợi nhớ không được vượt quá 150 ký tự'),
  consumer: z.string().trim().max(200, 'Tên đối tác không được vượt quá 200 ký tự').optional(),
  keyName: z.string().trim().max(120, 'Tên khóa không được vượt quá 120 ký tự').optional(),
  layer_id: z
    .number()
    .int('Mã lớp bản đồ không hợp lệ')
    .min(1, 'Vui lòng chọn lớp bản đồ'),
  scope: z
    .object({
      read: z.boolean().default(true),
      rate_per_min: z
        .number()
        .int('Giới hạn truy vấn phải là số nguyên')
        .min(1, 'Số yêu cầu tối thiểu là 1 request/phút')
        .max(6000, 'Số yêu cầu tối đa là 6000 request/phút')
        .default(60),
      bbox_limit: z
        .number()
        .positive('Giới hạn bbox phải lớn hơn 0')
        .max(360, 'Giới hạn bbox tối đa là 360 độ')
        .optional(),
    })
    .default({ read: true, rate_per_min: 60 }),
  is_active: z.boolean().default(true),
  expires_at: z
    .string()
    .datetime({ offset: true, message: 'Định dạng thời gian hết hạn không hợp lệ' })
    .nullable()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  slug: z.string().trim().optional(),
  readFields: z.array(z.string()).optional(),
  writeFields: z.array(z.string()).optional(),
  searchFields: z.array(z.string()).optional(),
  allowedMethods: z.array(z.string()).optional(),
  defaultSortField: z.string().optional(),
  scopes: z.array(z.string()).optional(),
})

/** Schema dùng cho form edit: `layer_id` không sửa được nên bỏ ràng buộc min(1) để tránh block submit khi API detail không trả layer_id. */
export const editMapLayerApiFormSchema = createMapLayerApiSchema.extend({
  layer_id: z.number().int().optional(),
})

export const updateMapLayerApiSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Tên gợi nhớ phải có ít nhất 3 ký tự')
      .max(150, 'Tên gợi nhớ không được vượt quá 150 ký tự')
      .optional(),
    scope: z
      .object({
        read: z.boolean().optional(),
        rate_per_min: z
          .number()
          .int('Giới hạn truy vấn phải là số nguyên')
          .min(1, 'Số yêu cầu tối thiểu là 1 request/phút')
          .max(6000, 'Số yêu cầu tối đa là 6000 request/phút')
          .optional(),
        bbox_limit: z
          .number()
          .positive('Giới hạn bbox phải lớn hơn 0')
          .max(360, 'Giới hạn bbox tối đa là 360 độ')
          .optional(),
      })
      .optional(),
    is_active: z.boolean().optional(),
    expires_at: z
      .string()
      .datetime({ offset: true, message: 'Định dạng thời gian hết hạn không hợp lệ' })
      .nullable()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    slug: z.string().trim().optional(),
    readFields: z.array(z.string()).optional(),
    writeFields: z.array(z.string()).optional(),
    searchFields: z.array(z.string()).optional(),
    allowedMethods: z.array(z.string()).optional(),
    defaultSortField: z.string().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Cần ít nhất 1 trường thay đổi',
  })

export const listQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  layer_id: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
})

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  const parsed = normalizePositiveNumber(value)
  return parsed > 0 ? parsed : undefined
}

function normalizeIsoDate(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function normalizeMapLayerApiInput(
  values: Partial<CreateMapLayerApiBody>
): CreateMapLayerApiBody {
  return {
    name: normalizeTrimmedString(values.name),
    ...(values.consumer ? { consumer: normalizeTrimmedString(values.consumer) } : {}),
    ...(values.keyName ? { keyName: normalizeTrimmedString(values.keyName) } : {}),
    layer_id: normalizePositiveNumber(values.layer_id),
    scope: {
      read: values.scope?.read !== false,
      rate_per_min: Math.floor(normalizePositiveNumber(values.scope?.rate_per_min) || 60),
      ...(normalizeOptionalPositiveNumber(values.scope?.bbox_limit) != null
        ? { bbox_limit: normalizeOptionalPositiveNumber(values.scope?.bbox_limit) }
        : {}),
    },
    is_active: values.is_active !== false,
    expires_at: normalizeIsoDate(values.expires_at),
    metadata:
      values.metadata && typeof values.metadata === 'object'
        ? (values.metadata as Record<string, unknown>)
        : undefined,
    ...(values.slug ? { slug: normalizeTrimmedString(values.slug).toLowerCase() } : {}),
    ...(Array.isArray(values.readFields) && values.readFields.length > 0 ? { readFields: values.readFields } : {}),
    ...(Array.isArray(values.writeFields) ? { writeFields: values.writeFields } : {}),
    ...(Array.isArray(values.searchFields) ? { searchFields: values.searchFields } : {}),
    ...(Array.isArray(values.allowedMethods) && values.allowedMethods.length > 0 ? { allowedMethods: values.allowedMethods } : {}),
    ...(values.defaultSortField ? { defaultSortField: normalizeTrimmedString(values.defaultSortField) } : {}),
    ...(Array.isArray(values.scopes) && values.scopes.length > 0 ? { scopes: values.scopes } : {}),
  } as CreateMapLayerApiBody
}

export function buildUpdatePayload(
  original: Partial<CreateMapLayerApiBody>,
  current: Partial<CreateMapLayerApiBody>
): UpdateMapLayerApiBody {
  const next = normalizeMapLayerApiInput(current)
  const prev = normalizeMapLayerApiInput(original)

  const payload: Record<string, any> = {}

  ;(Object.keys(next) as (keyof CreateMapLayerApiBody)[]).forEach((key) => {
    const nextValue = (next as any)[key]
    const prevValue = (prev as any)[key]
    const changed =
      typeof nextValue === 'object' || typeof prevValue === 'object'
        ? JSON.stringify(nextValue ?? null) !== JSON.stringify(prevValue ?? null)
        : nextValue !== prevValue

    if (changed) {
      payload[key as string] = (next as any)[key]
    }
  })

  return payload as UpdateMapLayerApiBody
}

export function validateCreatePayload(
  values: CreateMapLayerApiBody
): { success: true; data: CreateMapLayerApiBody } | { success: false; error: z.ZodError } {
  const normalized = normalizeMapLayerApiInput(values)
  const parsed = createMapLayerApiSchema.safeParse(normalized)
  if (!parsed.success) return { success: false, error: parsed.error }
  return {
    success: true,
    data: {
      ...parsed.data,
      metadata: normalized.metadata,
    } as CreateMapLayerApiBody,
  }
}

export function validateUpdatePayload(
  values: UpdateMapLayerApiBody
): { success: true; data: UpdateMapLayerApiBody } | { success: false; error: z.ZodError } {
  if (Object.keys(values).length === 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        { code: z.ZodIssueCode.custom, path: [], message: 'Cần ít nhất 1 trường thay đổi' },
      ]),
    }
  }
  const parsed = updateMapLayerApiSchema.safeParse(values)
  if (!parsed.success) return { success: false, error: parsed.error }
  return { success: true, data: parsed.data as UpdateMapLayerApiBody }
}

export function getMappedErrorMessage(error: unknown, fallback: string) {
  const status = (error as { status?: number; body?: { status?: number } })?.status
  const bodyStatus = (error as { body?: { status?: number } })?.body?.status
  const code = status ?? bodyStatus
  const serverMessage = (error as { body?: { message?: string } })?.body?.message
  const errors = (error as { body?: { errors?: string[] } })?.body?.errors

  if (Array.isArray(errors) && errors.length > 0) {
    const firstErr = errors[0]
    if (typeof firstErr === 'string') {
      if (firstErr.includes('INVALID_REGISTRY_FIELD')) {
        return 'Lớp bản đồ chưa được cấu hình trường dữ liệu hợp lệ (cần cấu hình displayFields trong quản lý lớp).'
      }
      if (firstErr.includes('REGISTRY_EXCEEDS_LAYER_METADATA')) {
        return 'Cấu hình trường vượt quá danh sách trường hiển thị của lớp bản đồ.'
      }
      if (firstErr.includes('REGISTRY_CONFLICT')) {
        return 'Lớp bản đồ này hoặc định danh (slug) đã tồn tại API chia sẻ.'
      }
      if (firstErr.includes('REGISTRY_FIELD_CONTRACT')) {
        return 'Trường tìm kiếm hoặc sắp xếp phải thuộc danh sách trường đọc của lớp.'
      }
      if (firstErr.includes('REGISTRY_WRITE_CONTRACT')) {
        return 'Phương thức ghi và danh sách trường ghi phải được cấu hình đồng thời.'
      }
      if (firstErr.includes('REGISTRY_EXCEEDS_LAYER_METADATA')) {
        return 'Cấu hình trường vượt quá danh sách trường cho phép trong siêu dữ liệu của lớp (displayFields / editableFields).'
      }
      if (firstErr.includes('INVALID_REGISTRY_FIELD')) {
        return 'Cấu hình trường không hợp lệ hoặc chứa trường bị cấm (như geom, id).'
      }
      if (firstErr.includes('API_GRANT_PERMISSION_REQUIRED')) {
        return 'Tài khoản cần có quyền phân quyền API (grant) để cấu hình phương thức ghi hoặc cấp quyền ghi.'
      }
      if (firstErr.includes('SCOPE_EXCEEDS_REGISTRY')) {
        return 'Quyền hạn của khóa vượt quá các phương thức được cho phép của API này.'
      }
      if (firstErr.includes('REGISTRY_DISABLED')) {
        return 'API này đang tạm dừng, không thể cấp thêm khóa mới.'
      }
      if (firstErr.includes('OPTIMISTIC_LOCK_CONFLICT')) {
        return 'Dữ liệu API đã được thay đổi bởi người khác. Vui lòng tải lại trang trước khi thao tác.'
      }
    }
  }

  if (serverMessage) {
    if (serverMessage.includes('contains a duplicate value') || serverMessage.includes('duplicate')) {
      return 'Cấu hình trường dữ liệu của lớp bản đồ bị trùng lặp. Vui lòng kiểm tra lại.'
    }
    if (serverMessage.includes('đã được đăng ký') || serverMessage.includes('đã tồn tại')) {
      return 'Lớp bản đồ này hoặc mã định danh (slug) đã được tạo API chia sẻ.'
    }
    if (serverMessage.includes('Cấu hình trường không hợp lệ')) {
      return 'Lớp bản đồ chưa được cấu hình trường dữ liệu hợp lệ (cần cấu hình displayFields trong quản lý lớp).'
    }
    return serverMessage
  }

  if (code === 401) return 'Token/apikey không hợp lệ hoặc đã hết hạn.'
  if (code === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (code === 404) return 'Dữ liệu không tồn tại hoặc đã bị xóa.'
  if (code === 409) return 'API key hoặc cấu hình chia sẻ đã tồn tại. Vui lòng kiểm tra lại.'
  if (code === 400 || code === 422) return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'

  // Client-side failures (network/timeout/runtime) carry no Server `body`; show
  // the caller's localized fallback instead of leaking raw Error text into UI.
  return fallback
}
