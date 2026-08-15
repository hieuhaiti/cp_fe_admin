import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  citizenFeedbackService,
  floodService,
  forestClassificationService,
  newsCommentService,
  userService,
  useApiQuery,
} from '@/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquareWarning,
  MessagesSquare,
  Users,
  Trees,
  Mountain,
  Waves,
  RefreshCcw,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/date'
import type {
  ApiResponse,
  CitizenFeedback,
  CitizenFeedbackListData,
  FloodDashboard,
  ForestClassLatestData,
  NewsComment,
  NewsCommentListData,
  User,
  UserListData,
} from '@/types/api'

/**
 * Dashboard tổng hợp cho admin.
 *
 * 5 khối theo yêu cầu:
 * 1. Phản ánh hiện trường  — count + list mới nhất
 * 2. Comment chờ duyệt      — count + list mới nhất
 * 3. Người dùng             — total + chart tăng trưởng theo tháng
 * 4. Rừng + Mỏ              — KPI diện tích, tỉ lệ, kỳ
 * 5. Ngập lụt & thủy văn    — trạng thái 5 mô-đun M1–M5
 *
 * Dashboard chỉ đọc dữ liệu — mọi thao tác quản trị nằm ở trang chuyên đề tương
 * ứng. Mỗi khối có link "Xem chi tiết →" mở page quản lý.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  new: 'Mới',
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  under_review: 'Đang xem xét',
  resolved: 'Đã xử lý',
  approved: 'Đã tiếp nhận',
  rejected: 'Từ chối',
}
const FEEDBACK_STATUS_TONE: Record<string, string> = {
  new: 'bg-amber-100 text-amber-900 border-amber-200',
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  in_progress: 'bg-sky-100 text-sky-900 border-sky-200',
  under_review: 'bg-sky-100 text-sky-900 border-sky-200',
  resolved: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  approved: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-red-100 text-red-900 border-red-200',
}

const FLOOD_MODULE_INFO: Array<{ code: string; short: string; name: string }> = [
  { code: 'event', short: 'M1', name: 'Hiện trạng ngập' },
  { code: 'hand', short: 'M2', name: 'Nhạy cảm địa hình' },
  { code: 'rain', short: 'M3', name: 'Chỉ số nguy cơ theo mưa' },
  { code: 'impact', short: 'M4', name: 'Tác động ngập' },
  { code: 'trend', short: 'M5', name: 'Xu thế nhiều năm' },
]
const FLOOD_STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Đang chờ',
  COMPUTING: 'Đang tính',
  EXPORTING: 'Đang xuất',
  HARVESTING: 'Đang thu nhận',
  VALIDATING: 'Đang kiểm định',
  ARCHIVING: 'Đang lưu',
  PUBLISHING: 'Đang công bố',
  SUCCEEDED: 'Hoàn thành',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  DLQ: 'Cần xử lý',
}
const FLOOD_STATUS_TONE: Record<string, string> = {
  SUCCEEDED: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  FAILED: 'bg-red-100 text-red-900 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  DLQ: 'bg-red-100 text-red-900 border-red-200',
}

const formatHa = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
const formatPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
const formatCount = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('vi-VN')
const formatPeriod = (year?: number, month?: number) =>
  year && month ? `${String(month).padStart(2, '0')}/${year}` : '—'

// Aggregate `User.createdAt` into `{ month: 'MM/YY', count }` for last N months.
function bucketUsersByMonth(users: User[], monthsBack = 6) {
  const now = new Date()
  const buckets: Array<{ key: string; label: string; count: number }> = []
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(-2)}`
    buckets.push({ key, label, count: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const u of users) {
    const iso = u.createdAt || u.created_at
    if (!iso) continue
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const bucket = byKey.get(key)
    if (bucket) bucket.count += 1
  }
  return buckets
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // 1. Feedback — pull top 5 for list + tổng qua metadata.total
  const feedbackQuery = useApiQuery(
    ['dashboard', 'feedback'],
    () => citizenFeedbackService.getAll({ page: 1, limit: 5 }),
    {},
    false,
    false
  )

  // 2. Unmoderated comments — status='pending'
  const commentQuery = useApiQuery(
    ['dashboard', 'unmoderated-comments'],
    () => newsCommentService.getAll({ page: 1, limit: 5, status: 'pending' }),
    {},
    false,
    false
  )

  // 3. Users — pull latest 100 (backend cap) để dựng chart 6 tháng gần nhất
  const userQuery = useApiQuery(
    ['dashboard', 'users'],
    () => userService.getAll({ page: 1, limit: 100, sortBy: 'created_at', sortOrder: 'DESC' }),
    {},
    false,
    false
  )

  // 4. Forest classification latest snapshot
  const forestQuery = useApiQuery(
    ['dashboard', 'forest'],
    () => forestClassificationService.getLatest(),
    {},
    false,
    false
  )

  // 5. Flood dashboard (modules + published layers)
  const floodQuery = useApiQuery(['dashboard', 'flood'], () => floodService.getDashboard(), {}, false)

  const feedbackRes = feedbackQuery.data as ApiResponse<CitizenFeedbackListData> | undefined
  const commentRes = commentQuery.data as ApiResponse<NewsCommentListData> | undefined
  const userRes = userQuery.data as ApiResponse<UserListData> | undefined
  const forestRes = forestQuery.data as ApiResponse<ForestClassLatestData> | undefined
  const floodRes = floodQuery.data as ApiResponse<FloodDashboard> | undefined

  const feedbackItems = (feedbackRes?.data?.items ?? []) as CitizenFeedback[]
  const feedbackTotal = Number(feedbackRes?.metadata?.total ?? feedbackItems.length) || 0

  const commentItems = (commentRes?.data?.items ?? commentRes?.data?.comments ?? []) as NewsComment[]
  const commentTotal =
    Number(commentRes?.metadata?.total ?? commentRes?.data?.pagination?.total ?? 0) || 0

  const users = (userRes?.data?.items ?? userRes?.data?.users ?? []) as User[]
  const userTotal =
    Number(userRes?.metadata?.total ?? userRes?.data?.pagination?.total ?? users.length) || 0
  const userBuckets = useMemo(() => bucketUsersByMonth(users, 6), [users])

  const forestSnapshot = forestRes?.data?.snapshot ?? null
  const forestSummary = forestSnapshot?.provinceSummary ?? undefined
  const forestHa = Number(forestSummary?.forestHa ?? 0)
  const forestPct = Number(forestSummary?.forestPercent ?? 0)
  const mineHa = Number(forestSummary?.mineHa ?? 0)
  const minePct = Number(forestSummary?.minePercent ?? 0)
  const totalHa = Number(forestSummary?.totalHa ?? 0)

  const flood = floodRes?.data
  const floodModules = (flood?.modules ?? {}) as FloodDashboard['modules']
  const floodPublishedCount = flood?.layers?.length ?? 0
  const floodSucceededCount = Object.values(floodModules).filter(
    (m) => m?.status === 'SUCCEEDED'
  ).length

  const anyLoading =
    feedbackQuery.isLoading ||
    commentQuery.isLoading ||
    userQuery.isLoading ||
    forestQuery.isLoading ||
    floodQuery.isLoading
  const refetchAll = () => {
    feedbackQuery.refetch()
    commentQuery.refetch()
    userQuery.refetch()
    forestQuery.refetch()
    floodQuery.refetch()
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
          <p className="text-muted-foreground text-sm">
            Tổng hợp phản ánh, bình luận, người dùng, rừng/mỏ và ngập lụt của TP Cẩm Phả.
          </p>
        </div>
        <Button variant="outline" onClick={refetchAll} disabled={anyLoading}>
          <RefreshCcw className={`size-4 ${anyLoading ? 'animate-spin' : ''}`} /> Làm mới
        </Button>
      </div>

      {/* ── Hàng KPI: 5 số nổi bật ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={<MessageSquareWarning className="size-5 text-amber-600" />}
          label="Phản ánh hiện trường"
          value={formatCount(feedbackTotal)}
          hint="Tổng số phản ánh của người dân"
          tone="bg-amber-50"
        />
        <KpiCard
          icon={<MessagesSquare className="size-5 text-sky-600" />}
          label="Bình luận chờ duyệt"
          value={formatCount(commentTotal)}
          hint="Bình luận báo chí chưa kiểm duyệt"
          tone="bg-sky-50"
        />
        <KpiCard
          icon={<Users className="size-5 text-indigo-600" />}
          label="Người dùng"
          value={formatCount(userTotal)}
          hint="Tổng tài khoản trên hệ thống"
          tone="bg-indigo-50"
        />
        <KpiCard
          icon={<Trees className="size-5 text-emerald-600" />}
          label="Diện tích rừng"
          value={forestSummary ? formatHa(forestHa) : '—'}
          hint={
            forestSummary
              ? `${formatPct(forestPct)} · Kỳ ${formatPeriod(forestSnapshot?.year, forestSnapshot?.month)}`
              : 'Chưa có kết quả phân loại'
          }
          tone="bg-emerald-50"
        />
        <KpiCard
          icon={<Mountain className="size-5 text-stone-700" />}
          label="Diện tích khu mỏ"
          value={forestSummary ? formatHa(mineHa) : '—'}
          hint={
            forestSummary
              ? `${formatPct(minePct)} · Tổng ${formatHa(totalHa)}`
              : 'Chưa có kết quả phân loại'
          }
          tone="bg-stone-50"
        />
      </div>

      {/* ── Hàng 2: Chart người dùng + trạng thái ngập lụt ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-indigo-600" />
              Người dùng đăng ký mới theo tháng
            </CardTitle>
            <CardDescription>
              6 tháng gần nhất — tổng hợp từ {formatCount(users.length)} tài khoản mới nhất.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {userQuery.isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userBuckets} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value) => [`${Number(value) || 0} tài khoản`, 'Đăng ký mới']}
                    labelFormatter={(label) => `Tháng ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {userBuckets.map((_, index) => (
                      <Cell key={index} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <FloodStatusCard
          modules={floodModules}
          publishedCount={floodPublishedCount}
          succeededCount={floodSucceededCount}
          loading={floodQuery.isLoading}
        />
      </div>

      {/* ── Hàng 3: Chart rừng/mỏ + danh sách phản ánh + comment ───────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ForestVsMineCard
          forestHa={forestHa}
          mineHa={mineHa}
          totalHa={totalHa}
          period={formatPeriod(forestSnapshot?.year, forestSnapshot?.month)}
          loading={forestQuery.isLoading}
        />
        <RecentFeedbackCard
          items={feedbackItems}
          total={feedbackTotal}
          loading={feedbackQuery.isLoading}
        />
        <UnmoderatedCommentsCard
          items={commentItems}
          total={commentTotal}
          loading={commentQuery.isLoading}
        />
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: string
}) {
  return (
    <Card className={tone}>
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 truncate text-2xl font-semibold" title={value}>
          {value}
        </div>
        {hint ? <div className="text-muted-foreground mt-1 truncate text-xs">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

function FloodStatusCard({
  modules,
  publishedCount,
  succeededCount,
  loading,
}: {
  modules: FloodDashboard['modules']
  publishedCount: number
  succeededCount: number
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Waves className="size-4 text-sky-600" />
          Ngập lụt & thủy văn
        </CardTitle>
        <CardDescription>
          {succeededCount}/5 mô-đun hoàn thành · {publishedCount} lớp đã công bố
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <>
            {FLOOD_MODULE_INFO.map((info) => {
              const module = modules?.[info.code as keyof typeof modules]
              const status = module?.status
              const label = status ? FLOOD_STATUS_LABEL[status] || status : 'Chưa có'
              return (
                <div
                  key={info.code}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-muted-foreground text-xs">{info.short}</span>
                    <span className="ml-2 font-medium">{info.name}</span>
                  </div>
                  <Badge variant="outline" className={status ? FLOOD_STATUS_TONE[status] || '' : ''}>
                    {label}
                  </Badge>
                </div>
              )
            })}
            <Link
              to="/flood"
              className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Mở trung tâm vận hành <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ForestVsMineCard({
  forestHa,
  mineHa,
  totalHa,
  period,
  loading,
}: {
  forestHa: number
  mineHa: number
  totalHa: number
  period: string
  loading: boolean
}) {
  const data = [
    { label: 'Rừng', value: forestHa, fill: '#059669' },
    { label: 'Khu mỏ', value: mineHa, fill: '#57534e' },
    { label: 'Khác', value: Math.max(totalHa - forestHa - mineHa, 0), fill: '#94a3b8' },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trees className="size-4 text-emerald-600" />
          Rừng & Mỏ tại Cẩm Phả
        </CardTitle>
        <CardDescription>
          Kỳ {period} · Tổng phân loại {formatHa(totalHa)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : totalHa === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Chưa có kết quả phân loại rừng.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => Number(v).toLocaleString('vi-VN')}
                />
                <RechartsTooltip formatter={(value) => [formatHa(Number(value) || 0), 'Diện tích']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Link
              to="/forest-classification"
              className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Xem chi tiết phân loại <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecentFeedbackCard({
  items,
  total,
  loading,
}: {
  items: CitizenFeedback[]
  total: number
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareWarning className="size-4 text-amber-600" />
          Phản ánh mới nhất
        </CardTitle>
        <CardDescription>
          Tổng {formatCount(total)} phản ánh — hiển thị 5 mục gần nhất
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Chưa có phản ánh nào.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const iso = item.createdAt || item.created_at
              return (
                <li key={item.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium" title={item.title}>
                      {item.title || 'Không tiêu đề'}
                    </span>
                    <Badge
                      variant="outline"
                      className={FEEDBACK_STATUS_TONE[item.status] || 'border-slate-200'}
                    >
                      {FEEDBACK_STATUS_LABEL[item.status] || item.status}
                    </Badge>
                  </div>
                  {iso ? (
                    <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(iso)}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <Link
          to="/feedbacks"
          className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          Xem toàn bộ phản ánh <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

function UnmoderatedCommentsCard({
  items,
  total,
  loading,
}: {
  items: NewsComment[]
  total: number
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="size-4 text-sky-600" />
          Bình luận chờ duyệt
        </CardTitle>
        <CardDescription>
          Tổng {formatCount(total)} bình luận đang chờ — hiển thị 5 mục gần nhất
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Không có bình luận nào chờ duyệt.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((comment) => {
              const c = comment as NewsComment & {
                content?: string
                userName?: string
                user_name?: string
                createdAt?: string
                created_at?: string
                newsTitle?: string | null
                news_title?: string | null
              }
              const name = c.userName || c.user_name || 'Ẩn danh'
              const iso = c.createdAt || c.created_at
              const newsTitle = c.newsTitle || c.news_title
              return (
                <li key={comment.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 font-medium">{name}</span>
                    {iso ? (
                      <span className="text-muted-foreground text-xs">{formatDateTime(iso)}</span>
                    ) : null}
                  </div>
                  {c.content ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{c.content}</p>
                  ) : null}
                  {newsTitle ? (
                    <p className="text-muted-foreground mt-1 truncate text-[11px] italic">
                      Bài viết: {newsTitle}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <Link
          to="/news-comments"
          className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          Vào trang duyệt bình luận <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
