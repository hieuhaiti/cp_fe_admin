import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminDashboardService, useApiQuery } from '@/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { navConfig } from '@/constant/common'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { checkPermission, ROLE_LABELS, getUserRole, ROLES, hasPerm } from '@/lib/permissions'
import { formatModelStatus } from '@/lib/uiTerminology'
import type { AdminDashboardOverview, ApiResponse } from '@/types/api'
import type { NavItem } from '@/types/common'
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Building2,
  Database,
  FileCheck2,
  Layers,
  LayoutDashboard,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  Trees,
  UserCheck,
  Waves,
} from 'lucide-react'

const HDSD_PDF_URL = 'https://apicampha.tourismpj.pro.vn/uploads/HDSD_ADMIN_CAMPHA.pdf'

function formatPct(v?: number | null) {
  if (v == null) return null
  return `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

function formatHa(v?: number | null) {
  if (v == null) return null
  return `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
}

function formatInt(v?: number | null) {
  if (v == null) return null
  return v.toLocaleString('vi-VN')
}

function formatPeriod(year?: number | null, month?: number | null) {
  if (!year || !month) return null
  return `Tháng ${String(month).padStart(2, '0')}/${year}`
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  const fmt = (s: string) => s.slice(0, 10)
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  return fmt(start ?? end ?? '')
}

function isExternalPath(path: string) {
  return /^https?:\/\//i.test(path)
}

interface RoleBriefing {
  badge: string
  title: string
  description: string
  priorityPaths: string[]
  primaryCta: { label: string; path: string; icon: React.ReactNode }
}

function getRoleBriefing(role: string | null): RoleBriefing {
  switch (role) {
    case ROLES.SYSTEM_ADMIN:
      return {
        badge: 'Trung tâm quản trị kỹ thuật',
        title: 'Giám sát hạ tầng dữ liệu & quyền truy cập',
        description:
          'Quản lý danh mục người dùng, cấp quyền truy cập bản đồ, xuất bản dữ liệu ảnh và kiểm soát phân quyền chặt chẽ.',
        priorityPaths: ['/users', '/map-layers', '/map-apis', '/dashboard'],
        primaryCta: {
          label: 'Quản lý người dùng',
          path: '/users',
          icon: <UserCheck className="mr-2 h-4 w-4" />,
        },
      }
    case ROLES.UBND_TP:
      return {
        badge: 'Trung tâm chỉ đạo & điều hành đô thị',
        title: 'Theo dõi tổng quan ngập lụt, quy hoạch & phản ánh',
        description:
          'Cập nhật kịp thời vùng ngập cảnh báo, diễn biến thời tiết, hiện trạng sử dụng đất và kiến nghị người dân.',
        priorityPaths: ['/dashboard', '/flood', '/feedbacks', '/map-layers'],
        primaryCta: {
          label: 'Bảng điều hành đô thị',
          path: '/dashboard',
          icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
        },
      }
    case ROLES.SO_TNMT:
      return {
        badge: 'Cơ quan chuyên môn Tài nguyên & Môi trường',
        title: 'Quản lý hiện trạng đất đai, lâm nghiệp & ngập lụt',
        description:
          'Vận hành mô hình dự báo ngập lụt, cập nhật phân loại rừng, quản trị lớp bản đồ chuyên ngành và xử lý phản ánh.',
        priorityPaths: ['/map-layers', '/flood', '/forest-classification', '/feedbacks'],
        primaryCta: {
          label: 'Quản lý lớp bản đồ',
          path: '/map-layers',
          icon: <Layers className="mr-2 h-4 w-4" />,
        },
      }
    case ROLES.SO_XD:
      return {
        badge: 'Cơ quan quản lý Quy hoạch & Hạ tầng Xây dựng',
        title: 'Theo dõi hạ tầng thoát nước, xây dựng & không gian',
        description:
          'Đánh giá diện tích ngập ảnh hưởng tới khu dân cư, tra cứu bản đồ PDF quy hoạch và giám sát báo cáo hiện trường.',
        priorityPaths: ['/map-layers', '/map-images', '/flood', '/feedbacks'],
        primaryCta: {
          label: 'Tra cứu lớp dữ liệu',
          path: '/map-layers',
          icon: <Layers className="mr-2 h-4 w-4" />,
        },
      }
    default:
      return {
        badge: 'Cổng thông tin nghiệp vụ WebGIS',
        title: 'Hệ thống bản đồ số & tài nguyên TP Cẩm Phả',
        description:
          'Truy cập các lớp bản đồ số, tài liệu và dữ liệu chuyên ngành theo phân quyền được cấp.',
        priorityPaths: ['/dashboard', '/map-layers', '/documents', '/news'],
        primaryCta: {
          label: 'Bảng điều khiển',
          path: '/dashboard',
          icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
        },
      }
  }
}

export default function LandingPage() {
  const user = useAuthStore((s) => s.user)
  const userName = user?.fullName || user?.email || 'Đồng chí'
  const userRole = getUserRole(user)
  const roleLabel = user ? (ROLE_LABELS[userRole ?? ''] ?? 'Cán bộ nghiệp vụ') : ''
  const briefing = useMemo(() => getRoleBriefing(userRole), [userRole])

  const canReadOverview = Boolean(user)
  const overviewQuery = useApiQuery(
    ['landing', 'overview'],
    () => adminDashboardService.getOverview(),
    { enabled: canReadOverview, staleTime: 60_000 },
    false,
    false
  )

  const overview = (overviewQuery.data as ApiResponse<AdminDashboardOverview> | undefined)?.data
  const isLoading = overviewQuery.isLoading
  const isError = overviewQuery.isError

  // Quyền truy cập cụ thể để hiển thị chính xác các block
  const canFlood = hasPerm(user, 'flood', 'read')
  const canForest = hasPerm(user, 'forest_classification', 'read')
  const canFeedback = hasPerm(user, 'field_report', 'read') || hasPerm(user, 'field_report', 'stats')
  const canLayers = hasPerm(user, 'layers', 'read')

  // Lọc và sắp xếp các liên kết module theo quyền và ưu tiên của vai trò
  const { priorityLinks, otherLinks } = useMemo(() => {
    const permitted = navConfig
      .filter((item): item is NavItem => !isExternalPath(item.path))
      .filter((item) => checkPermission(user, item.permission))

    const prioritySet = new Set(briefing.priorityPaths)
    const priority: NavItem[] = []
    const other: NavItem[] = []

    permitted.forEach((item) => {
      if (prioritySet.has(item.path)) {
        priority.push(item)
      } else {
        other.push(item)
      }
    })

    // Sắp xếp priority theo thứ tự được định nghĩa trong role briefing
    priority.sort(
      (a, b) => briefing.priorityPaths.indexOf(a.path) - briefing.priorityPaths.indexOf(b.path)
    )

    return { priorityLinks: priority, otherLinks: other }
  }, [user, briefing])

  const flood = overview?.flood
  const land = overview?.landComposition
  const cls = overview?.classification
  const feedback = overview?.feedback
  const layers = overview?.layers

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
      {/* ── 1. Hero tác nghiệp cá nhân hóa theo vai trò ─────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-secondary/30 p-6 md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {briefing.badge}
              </span>
              <span className="text-xs text-muted-foreground">
                Phiên làm việc: {roleLabel}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Chào {userName} · {briefing.title}
            </h1>

            <p className="text-sm text-muted-foreground md:text-base leading-relaxed">
              {briefing.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {canReadOverview && (
              <Button asChild size="lg" className="shadow-sm">
                <Link to={briefing.primaryCta.path}>
                  {briefing.primaryCta.icon}
                  {briefing.primaryCta.label}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={() => overviewQuery.refetch()}
              disabled={isLoading}
              title="Làm mới chỉ số"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Cập nhật</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── 2. Khối chỉ số tác nghiệp từ dữ liệu thực ────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Chỉ số vận hành & Hiện trạng thực tế
            </h2>
            <p className="text-xs text-muted-foreground">
              Số liệu tổng hợp từ cơ sở dữ liệu GIS và kết quả các mô hình đã nghiệm thu.
            </p>
          </div>
          {overview?.generatedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Đồng bộ lúc: {new Date(overview.generatedAt).toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        {isError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 text-destructive text-sm font-medium">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>Không thể kết nối hệ thống để tải số liệu tổng quan.</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => overviewQuery.refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Lớp dữ liệu bản đồ */}
            {canLayers && (
              <OperationalKpiCard
                loading={isLoading}
                icon={<Database className="h-5 w-5 text-primary" />}
                title="Lớp dữ liệu bản đồ"
                value={layers ? formatInt(layers.total) : '—'}
                unit="lớp"
                statusBadge={
                  layers?.published ? `${layers.published} đã xuất bản` : undefined
                }
                meta={
                  layers?.latestUpdatedAt
                    ? `Cập nhật: ${new Date(layers.latestUpdatedAt).toLocaleDateString('vi-VN')}`
                    : 'Dữ liệu bản đồ'
                }
                linkTo="/map-layers"
                linkText="Xem danh mục"
              />
            )}

            {/* KPI 2: Ngập lụt & Thủy văn */}
            {canFlood && (
              <OperationalKpiCard
                loading={isLoading}
                icon={<Waves className="h-5 w-5 text-sky-600" />}
                title="Giám sát ngập lụt"
                value={
                  flood?.floodExtentAreaHa != null
                    ? formatHa(flood.floodExtentAreaHa)
                    : flood
                      ? 'Đã chạy mô hình'
                      : 'Chưa có kỳ'
                }
                statusBadge={
                  formatModelStatus(flood?.status)
                }
                meta={
                  flood
                    ? `Kỳ: ${formatDateRange(flood.monitorStart, flood.monitorEnd) || 'Gần nhất'}`
                    : 'Chưa có phân tích hoàn tất'
                }
                linkTo="/flood"
                linkText="Chi tiết kịch bản"
              />
            )}

            {/* KPI 3: Phân loại tài nguyên Rừng/Mỏ */}
            {canForest && (
              <OperationalKpiCard
                loading={isLoading}
                icon={<Trees className="h-5 w-5 text-emerald-600" />}
                title="Che phủ rừng & tài nguyên"
                value={
                  land?.forestPercent != null
                    ? formatPct(land.forestPercent)
                    : cls?.totalAreaHa != null
                      ? formatHa(cls.totalAreaHa)
                      : 'Chưa có kỳ dữ liệu'
                }
                statusBadge={
                  cls?.year && cls?.month ? formatPeriod(cls.year, cls.month) || undefined : undefined
                }
                meta={
                  land?.forestAreaHa != null
                    ? `Diện tích: ${formatHa(land.forestAreaHa)}`
                    : 'Phân loại ảnh viễn thám'
                }
                linkTo="/forest-classification"
                linkText="Xem kết quả"
              />
            )}

            {/* KPI 4: Phản ánh hiện trường từ Mobile */}
            {canFeedback && (
              <OperationalKpiCard
                loading={isLoading}
                icon={<MessageSquareWarning className="h-5 w-5 text-amber-600" />}
                title="Phản ánh hiện trường"
                value={
                  feedback
                    ? formatInt(
                        (feedback.byStatus?.pending ?? 0) +
                          (feedback.byStatus?.under_review ?? 0)
                      )
                    : '—'
                }
                unit="chờ xử lý"
                statusBadge={
                  feedback?.total != null ? `Tổng số: ${feedback.total}` : undefined
                }
                meta={
                  feedback?.byStatus?.resolved != null
                    ? `Đã xử lý: ${feedback.byStatus.resolved} phản ánh`
                    : 'Cộng đồng & Hiện trường'
                }
                linkTo="/feedbacks"
                linkText="Xử lý phản ánh"
              />
            )}
          </div>
        )}
      </section>

      {/* ── 3. Lối vào tác nghiệp theo thẩm quyền (Ưu tiên vai trò) ─────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Lối tắt tác nghiệp trọng tâm
          </h2>
          <p className="text-xs text-muted-foreground">
            Các phân hệ nghiệp vụ ưu tiên cho vị trí công tác của bạn.
          </p>
        </div>

        {priorityLinks.length === 0 && otherLinks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Tài khoản chưa được phân quyền truy cập chức năng nghiệp vụ nào. Vui lòng liên hệ Quản trị viên để cấp quyền.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {priorityLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:bg-accent/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {item.icon}
                    </div>
                    <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      Trọng tâm
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      Truy cập trực tiếp phân hệ {item.name.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                  <span>Mở phân hệ</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}

            {otherLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:border-border/80 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Phân hệ bổ trợ</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Thông tin quy chuẩn & Tài liệu nghiệp vụ ──────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-4 w-4" />
              <CardTitle className="text-sm font-semibold">Đơn vị chủ quản & Vận hành</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Hệ thống thông tin địa lý và cảnh báo thiên tai thành phố Cẩm Phả
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-1 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t pt-2 gap-1">
              <span className="font-medium text-foreground">Cơ quan chủ quản:</span>
              <span>Ủy ban nhân dân thành phố Cẩm Phả · Tỉnh Quảng Ninh</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t pt-2 gap-1">
              <span className="font-medium text-foreground">Đơn vị phối hợp chuyên môn:</span>
              <span>Sở Tài nguyên & Môi trường · Sở Xây dựng</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t pt-2 gap-1">
              <span className="font-medium text-foreground">Tiêu chuẩn kỹ thuật:</span>
              <span>Hệ tọa độ VN-2000 / UTM zone 48N</span>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <BookOpenText className="h-4 w-4" />
              <CardTitle className="text-sm font-semibold">Tài liệu hướng dẫn</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Quy trình thao tác chuẩn cho cán bộ quản trị và nghiệp vụ
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <a
              href={HDSD_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Sổ tay hướng dẫn Admin (PDF)
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function OperationalKpiCard({
  loading,
  icon,
  title,
  value,
  unit,
  statusBadge,
  meta,
  linkTo,
  linkText,
}: {
  loading: boolean
  icon: React.ReactNode
  title: string
  value: string | null
  unit?: string
  statusBadge?: string
  meta: string
  linkTo: string
  linkText: string
}) {
  return (
    <Card className="flex flex-col justify-between transition-all hover:shadow-xs">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            {icon}
            {title}
          </span>
          {statusBadge && !loading && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {statusBadge}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 py-1">
            <div className="h-7 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {value ?? '—'}
              </span>
              {unit && value && value !== '—' && (
                <span className="text-xs font-medium text-muted-foreground">{unit}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground truncate" title={meta}>
              {meta}
            </p>
          </div>
        )}
      </CardContent>

      <div className="border-t px-4 py-2 bg-muted/20">
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {linkText}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  )
}

