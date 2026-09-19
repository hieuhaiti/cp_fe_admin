export interface LayerCategory {
  id?: number
  key: string
  name: string
  isVisible?: boolean
  layerCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateLayerCategoryBody {
  name: string
}
