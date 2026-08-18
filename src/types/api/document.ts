export interface Document {
  id: number
  title: string
  document_code: string
  issuing_agency: string
  issued_at: string | null
  description: string | null
  visibility: 'public' | 'internal'
  original_name: string
  size_bytes: number | null
  created_at: string
  updated_at: string
  // admin-only fields (present when fetched via admin endpoint)
  file_object_id?: number
}

export interface DocumentListData {
  items: Document[]
}

export interface DocumentListParams {
  page?: number
  limit?: number
  q?: string
  sortBy?: 'issued_at' | 'created_at' | 'updated_at' | 'title' | 'document_code'
  sortOrder?: 'ASC' | 'DESC'
  visibility?: 'public' | 'internal'
}

export interface CreateDocumentBody {
  title: string
  documentCode: string
  issuingAgency: string
  issuedAt?: string | null
  description?: string | null
  visibility?: 'public' | 'internal'
  fileObjectId: number | string
}

export interface UpdateDocumentBody {
  expectedUpdatedAt: string
  title?: string
  documentCode?: string
  issuingAgency?: string
  issuedAt?: string | null
  description?: string | null
  visibility?: 'public' | 'internal'
}
