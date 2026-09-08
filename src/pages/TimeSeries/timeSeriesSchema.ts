import { z } from 'zod'

export const createTimeSeriesCollectionFormSchema = z
  .object({
    coverageKey: z
      .string()
      .trim()
      .min(2, 'Vui lòng chọn một nhóm dữ liệu chuỗi thời gian')
      .max(120, 'Mã bộ dữ liệu tối đa 120 ký tự')
      .regex(
        /^[a-z0-9][a-z0-9_-]{1,119}$/,
        'Mã bộ dữ liệu không hợp lệ'
      ),
    code: z
      .string()
      .trim()
      .min(1, 'Mã lớp không được để trống')
      .max(63, 'Mã lớp tối đa 63 ký tự')
      .regex(
        /^[a-z][a-z0-9_]{0,62}$/,
        'Mã lớp phải bắt đầu bằng chữ cái thường và chỉ chứa a-z, 0-9, _'
      ),
    nameVi: z
      .string()
      .trim()
      .min(1, 'Tên hiển thị không được để trống')
      .max(200, 'Tên hiển thị tối đa 200 ký tự'),
    category: z.string().trim().min(1, 'Nhóm lớp dữ liệu không hợp lệ').max(50),
    categoryName: z.string().trim().max(120).optional(),
    srid: z.number().int().min(1, 'EPSG/SRID không hợp lệ').max(999999).default(32648),
    minZoom: z.number().int().min(0).max(24).nullable().optional(),
    maxZoom: z.number().int().min(0).max(24).nullable().optional(),
    isPublic: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.minZoom != null && data.maxZoom != null && data.minZoom > data.maxZoom) {
        return false
      }
      return true
    },
    {
      message: 'Mức thu phóng nhỏ nhất không được lớn hơn mức thu phóng lớn nhất',
      path: ['maxZoom'],
    }
  )

export const editTimeSeriesLayerFormSchema = z
  .object({
    nameVi: z.string().trim().min(1, 'Tên hiển thị không được để trống').max(200),
    category: z.string().trim().min(1, 'Vui lòng chọn nhóm lớp').max(50),
    categoryName: z.string().trim().max(120).optional(),
    minZoom: z.number().int().min(0).max(24).nullable().optional(),
    maxZoom: z.number().int().min(0).max(24).nullable().optional(),
    isPublic: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.minZoom != null && data.maxZoom != null && data.minZoom > data.maxZoom) {
        return false
      }
      return true
    },
    { message: 'Mức thu phóng tối thiểu không được lớn hơn mức thu phóng tối đa', path: ['maxZoom'] }
  )

export type CreateTimeSeriesCollectionFormInput = z.input<typeof createTimeSeriesCollectionFormSchema>
export type CreateTimeSeriesCollectionFormValues = z.output<typeof createTimeSeriesCollectionFormSchema>
export type EditTimeSeriesLayerFormInput = z.input<typeof editTimeSeriesLayerFormSchema>
export type EditTimeSeriesLayerFormValues = z.output<typeof editTimeSeriesLayerFormSchema>
