export interface NewsCommentUser {
  id: number
  fullName?: string | null
  avatarUrl?: string | null

  // legacy
  full_name?: string | null
  avatar_url?: string | null
}

export interface NewsComment {
  id: number | string
  newsId?: number | string
  userId?: number | string | null
  user?: NewsCommentUser | null
  userName?: string | null
  userAvatar?: string | null
  newsTitle?: string | null
  newsSlug?: string | null
  content: string
  isApproved?: boolean
  /** API v2: status enum replaces is_approved boolean */
  status?: 'approved' | 'pending' | 'rejected' | string
  parentCommentId?: number | string | null
  replies?: NewsComment[]
  createdAt?: string
  updatedAt?: string

  // snake_case (API response)
  news_id?: number | string
  user_id?: number | string | null
  /** API v2: full display name returned by the backend directly */
  full_name?: string | null
  user_name?: string
  user_email?: string
  is_approved?: boolean
  parent_comment_id?: number | string | null
  created_at?: string
  updated_at?: string
  moderated_by?: number | string | null
  moderated_at?: string | null
}

/** Wrapper returned by GET /news-comments/:id */
export interface NewsCommentData {
  comment: NewsComment
}

export interface NewsCommentListData {
  items: NewsComment[]

  // legacy
  comments?: NewsComment[]
  pagination?: import('./index').Pagination
}

export type NewsCommentPublicList = NewsComment[]

export interface NewsCommentPublicListData {
  comments: NewsComment[]
}

export interface NewsCommentAdminListParams {
  page?: number
  limit?: number
  targetType?: 'news' | string
  targetId?: number
  status?: 'pending' | 'approved' | 'rejected'
  newsId?: number
  sortBy?: 'created_at' | 'updated_at'
  sortOrder?: 'ASC' | 'DESC'
}

export interface CreatePublicCommentBody {
  content: string
}

export interface ApproveCommentBody {
  isApproved: boolean
}
