export interface PdfMapTranslation {
  title: string
  description?: string | null
}

/**
 * Shape returned by GET /admin/cms/pdf-maps and /admin/cms/pdf-maps/:id.
 * Mirrors the actual columns of `cms.pdf_maps` joined with `core.file_objects`.
 * Server responses are snake_case; camelCase aliases are provided for
 * pages/components that prefer them, but only fields that truly exist are kept.
 */
export interface PdfMap {
  id: number
  title: string
  description?: string | null
  visibility: 'public' | 'internal'
  createdAt?: string
  updatedAt?: string
  createdBy?: number | null
  updatedBy?: number | null

  // snake_case as returned by the API
  scale_label?: string | null
  map_year?: number | null
  preparing_agency?: string | null
  original_name?: string | null
  size_bytes?: number | string | null
  created_at?: string
  updated_at?: string

  // camelCase convenience aliases (not sent by the API, resolved client-side)
  scaleLabel?: string | null
  mapYear?: number | null
  preparingAgency?: string | null
  fileName?: string | null
  fileSize?: number | string | null

  // admin detail may include both languages
  translations?: {
    vi?: PdfMapTranslation
    en?: PdfMapTranslation
  }
}

/** Alias so pages/dialogs previously typed against `MapImage` keep compiling. */
export type MapImage = PdfMap

export interface PdfMapListData {
  items: PdfMap[]
}

export interface PdfMapListParams {
  page?: number
  limit?: number
  q?: string
  yearFrom?: number
  yearTo?: number
  scaleLabel?: string
  visibility?: 'public' | 'internal'
  sortBy?: 'id' | 'year' | 'created_at' | 'updated_at' | 'title'
  sortOrder?: 'ASC' | 'DESC'
}

export type MapImageListParams = PdfMapListParams

export interface CreatePdfMapBody {
  title: string
  scaleLabel: string
  mapYear: number
  preparingAgency: string
  description?: string
  visibility: 'public' | 'internal'
  fileObjectId: number | string
}

export interface UpdatePdfMapBody {
  title?: string
  scaleLabel?: string
  mapYear?: number
  preparingAgency?: string
  description?: string
  visibility?: 'public' | 'internal'
  expectedUpdatedAt: string

  /** Kept for callers that still build translation-shaped patches. */
  translations?: {
    vi?: PdfMapTranslation
    en?: PdfMapTranslation
  }
}
