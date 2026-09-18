import { z } from 'zod'

export const layerCategoryItemSchema = z.object({
  id: z.number().optional(),
  key: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const layerCategoryListSchema = z.array(layerCategoryItemSchema)

export const createLayerCategoryBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên danh mục phải có ít nhất 2 ký tự')
    .max(120, 'Tên danh mục không được vượt quá 120 ký tự'),
})

export type ValidatedLayerCategory = z.infer<typeof layerCategoryItemSchema>
export type ValidatedCreateLayerCategoryBody = z.infer<typeof createLayerCategoryBodySchema>
