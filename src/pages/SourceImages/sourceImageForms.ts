import { z } from 'zod'

export const republishLayerFormSchema = z.object({
  code: z
    .string()
    .min(1, 'Mã lớp không được để trống')
    .max(63, 'Mã lớp tối đa 63 ký tự')
    .regex(/^[a-z][a-z0-9_]{0,62}$/, 'Mã lớp chỉ gồm chữ thường, số và dấu gạch dưới, bắt đầu bằng chữ cái'),
  nameVi: z.string().trim().min(1, 'Tên lớp hiển thị không được để trống').max(200, 'Tên lớp tối đa 200 ký tự'),
  category: z.string().trim().min(1, 'Vui lòng chọn danh mục').max(50, 'Danh mục tối đa 50 ký tự'),
  srid: z
    .number({ error: 'Vui lòng nhập hệ tọa độ (SRID) hợp lệ' })
    .int('SRID phải là số nguyên')
    .min(1, 'SRID phải từ 1 đến 999999')
    .max(999999, 'SRID phải từ 1 đến 999999'),
  minZoom: z.number().int().min(0).max(24).nullable().optional(),
  maxZoom: z.number().int().min(0).max(24).nullable().optional(),
  isPublic: z.boolean(),
}).refine(
  ({ minZoom, maxZoom }) => minZoom == null || maxZoom == null || minZoom <= maxZoom,
  { message: 'Mức thu phóng tối đa phải lớn hơn hoặc bằng mức tối thiểu', path: ['maxZoom'] }
)

export type RepublishLayerFormValues = z.infer<typeof republishLayerFormSchema>

export const changeCoverageKeyFormSchema = z.object({
  coverageKey: z
    .string()
    .min(2, 'Tên nhóm chuỗi thời gian phải có từ 2 ký tự trở lên')
    .max(120, 'Tên nhóm chuỗi thời gian tối đa 120 ký tự')
    .regex(/^[a-z0-9][a-z0-9_-]{1,119}$/, 'Tên nhóm chỉ gồm chữ thường, số, dấu gạch ngang hoặc gạch dưới'),
})

export type ChangeCoverageKeyFormValues = z.infer<typeof changeCoverageKeyFormSchema>
