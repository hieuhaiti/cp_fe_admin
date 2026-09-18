export interface LayerCategory {
  id?: number
  key: string
  name: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateLayerCategoryBody {
  name: string
}
