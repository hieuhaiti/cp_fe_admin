import { z } from 'zod'

const optionalNum = z
  .string()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || !isNaN(Number(v)), { message: 'Phải là số hợp lệ' })

const requiredNum = z
  .string()
  .min(1, 'Giá trị là bắt buộc')
  .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, { message: 'Phải là số không âm' })

export const scenarioTypeEnum = z.enum(['hien_trang', 'cai_tao', 'quy_hoach'])
export const rcpOptionEnum = z.enum(['rcp45', 'rcp85'])

export const scenarioGroupFormSchema = z.object({
  groupName: z.string().trim().min(1, 'Tên nhóm kịch bản là bắt buộc').max(150),
  frequency: z.string().trim().min(1, 'Tần suất mưa là bắt buộc'),
  tideLevel: optionalNum,
  minRainfall: requiredNum,
  maxRainfall: optionalNum,
  rain1h: optionalNum,
  rain3h: optionalNum,
  rain6h: optionalNum,
  rain12h: optionalNum,
  rain24h: optionalNum,

  hienTrang: z.object({
    code: z.string().trim().min(1, 'Mã kịch bản hiện trạng là bắt buộc'),
    nameVi: z.string().trim().min(1, 'Tên kịch bản hiện trạng là bắt buộc'),
    layerCode: z.string().trim().min(1, 'Vui lòng chọn lớp bản đồ'),
    isActive: z.boolean(),
    description: z.string().optional().or(z.literal('')),
  }),

  caiTao: z.object({
    code: z.string().trim().min(1, 'Mã kịch bản cải tạo là bắt buộc'),
    nameVi: z.string().trim().min(1, 'Tên kịch bản cải tạo là bắt buộc'),
    layerCode: z.string().trim().min(1, 'Vui lòng chọn lớp bản đồ'),
    isActive: z.boolean(),
    description: z.string().optional().or(z.literal('')),
  }),

  quyHoachRcp45: z.object({
    code: z.string().trim().min(1, 'Mã kịch bản quy hoạch RCP 4.5 là bắt buộc'),
    nameVi: z.string().trim().min(1, 'Tên kịch bản quy hoạch RCP 4.5 là bắt buộc'),
    layerCode: z.string().trim().min(1, 'Vui lòng chọn lớp bản đồ'),
    isActive: z.boolean(),
    description: z.string().optional().or(z.literal('')),
  }),

  quyHoachRcp85: z.object({
    code: z.string().trim().min(1, 'Mã kịch bản quy hoạch RCP 8.5 là bắt buộc'),
    nameVi: z.string().trim().min(1, 'Tên kịch bản quy hoạch RCP 8.5 là bắt buộc'),
    layerCode: z.string().trim().min(1, 'Vui lòng chọn lớp bản đồ'),
    isActive: z.boolean(),
    description: z.string().optional().or(z.literal('')),
  }),
})

export type ScenarioGroupFormSchema = z.infer<typeof scenarioGroupFormSchema>
