import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { userService, useApiQuery } from '@/service'
import type { ApiResponse, User } from '@/types/api'
import { parseLink } from '@/lib/utils'
import { formatDateTime } from '@/lib/date'

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'Quản trị hệ thống',
  ubnd_tp: 'UBND thành phố',
  so_tnmt: 'Sở TN&MT',
  so_xd: 'Sở Xây dựng',
  so_nnmt: 'Sở NN&MT (cũ)',
  ubnd_tinh: 'UBND tỉnh (cũ)',
  citizen: 'Người dân',
}

interface UserDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | string | null
}

function getUserDetail(response?: ApiResponse<User | { user?: User }>) {
  const data = response?.data
  if (!data) return null
  if ('user' in data && data.user) return data.user
  return data as User
}

function roleCodeOf(user?: User | null) {
  const role = user?.role
  if (typeof role === 'string') return role
  return user?.roleCode ?? role?.code ?? user?.role_name ?? null
}

function roleLabel(user?: User | null) {
  const code = roleCodeOf(user)
  return (
    user?.role_name_vi ?? (code ? ROLE_LABELS[code] : undefined) ?? user?.role_name ?? code ?? '-'
  )
}

const PERMISSION_RESOURCE_LABEL: Record<string, string> = {
  users: 'Người dùng',
  system_logs: 'Nhật ký hệ thống',
  layers: 'Lớp bản đồ',
  raster: 'Ảnh bản đồ',
  documents: 'Văn bản tài liệu',
  api_registry: 'API bản đồ',
  news: 'Tin tức',
  pdf_maps: 'Ảnh bản đồ PDF',
  field_report: 'Phản ánh hiện trường',
  hydro: 'Thủy văn',
  kttv: 'Khí tượng thủy văn',
  map: 'Bản đồ',
  map_feature: 'Đối tượng bản đồ',
  stats: 'Thống kê',
  spatial: 'Phân tích không gian',
  weather: 'Thời tiết',
  flood: 'Ngập lụt và thủy văn',
  flood_forecast: 'Dự báo ngập lụt',
  forest_classification: 'Phân loại đối tượng',
  satellite: 'Dữ liệu vệ tinh',
  map_layers: 'Lớp bản đồ',
  notifications: 'Thông báo',
}

const PERMISSION_ACTION_LABEL: Record<string, string> = {
  read: 'Xem', view: 'Xem', create: 'Thêm', update: 'Chỉnh sửa', delete: 'Xóa',
  change_status: 'Đổi trạng thái', reset_password: 'Đặt lại mật khẩu',
  change_role: 'Đổi vai trò', read_own: 'Xem thông tin cá nhân',
  update_own: 'Sửa thông tin cá nhân', manage: 'Quản lý',
  categorize: 'Phân loại danh mục', compare: 'So sánh', search: 'Tìm kiếm',
  download: 'Tải xuống', classify: 'Phân loại đối tượng', export_vector: 'Xuất dữ liệu vectơ',
  read_public: 'Xem nội dung công khai', read_internal: 'Xem nội dung nội bộ',
  download_internal: 'Tải nội dung nội bộ', share: 'Chia sẻ', grant: 'Phân quyền',
  comment: 'Bình luận', notify: 'Thông báo', stats: 'Thống kê', approve: 'Duyệt',
  measure: 'Đo đạc', edit_params: 'Sửa tham số', run: 'Chạy mô hình',
  calibrate: 'Hiệu chỉnh', version: 'Quản lý phiên bản', import_export: 'Nhập và xuất',
  set_threshold: 'Đặt ngưỡng', publish_scenario: 'Công bố kịch bản',
  create_source: 'Thêm nguồn dữ liệu', test_source: 'Kiểm tra nguồn dữ liệu',
  config_spatial: 'Cấu hình không gian', config_temporal: 'Cấu hình thời gian',
  config_variables: 'Cấu hình biến', manage_stations: 'Quản lý trạm', schedule: 'Lập lịch',
  display_config: 'Cấu hình hiển thị', alarm_threshold: 'Ngưỡng cảnh báo',
  view_attributes: 'Xem thuộc tính', search_feature: 'Tìm đối tượng',
  view_3d: 'Xem 3D', view_legend: 'Xem chú giải', locate: 'Định vị',
  route: 'Tìm đường', draw: 'Vẽ', export: 'Xuất dữ liệu', analyze: 'Phân tích',
  manual_input: 'Nhập dữ liệu thủ công', match_scenario: 'Đối chiếu kịch bản',
  publish: 'Công bố', ingest_raster: 'Nhập ảnh bản đồ', send: 'Gửi',
  ground_truth: 'Dữ liệu kiểm chứng thực địa',
}

function PermissionList({ permissions }: { permissions: User['role_permissions'] }) {
  if (!permissions) return null

  return (
    <div className="col-span-2 flex flex-col gap-2">
      {Object.entries(permissions).map(([resource, actions]) => {
        const enabledActions = Array.isArray(actions)
          ? actions
          : Object.entries(actions)
              .filter(([, enabled]) => Boolean(enabled))
              .map(([action]) => action)

        if (enabledActions.length === 0) return null

        return (
          <div key={resource} className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground shrink-0 text-xs font-medium">{PERMISSION_RESOURCE_LABEL[resource] || resource}:</span>
            {enabledActions.map((action) => (
              <Badge key={action} variant="outline" className="text-xs">
                {PERMISSION_ACTION_LABEL[action] || action}
              </Badge>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <div className="col-span-2">{children}</div>
    </div>
  )
}

export default function UserDetailDialog({ open, onOpenChange, userId }: UserDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['user', userId],
    () => userService.getById(userId!),
    { enabled: !!userId && open, staleTime: 0 },
    false,
    false
  )
  const user = getUserDetail(dbQuery.data as ApiResponse<User | { user?: User }> | undefined)
  const fullName = user?.fullName ?? user?.full_name ?? null
  const avatarUrl = user?.avatarUrl ?? user?.avatar_url ?? null
  const addressDetail = user?.addressDetail ?? user?.address_detail ?? null
  const isActive = user?.isActive ?? user?.is_active ?? null
  const isEmailVerified = user?.isEmailVerified ?? user?.email_verified ?? false
  const hasPassword = user?.hasPassword ?? !user?.must_change_password
  const lastLoginAt = user?.lastLoginAt ?? user?.last_login_at ?? user?.last_login ?? null
  const createdAt = user?.createdAt ?? user?.created_at ?? null
  const updatedAt = user?.updatedAt ?? user?.updated_at ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết người dùng</DialogTitle>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive py-8 text-center">
            Không thể tải thông tin người dùng.
          </div>
        ) : user ? (
          <div className="mt-4 space-y-3">
            <Row label="ID">{user.id}</Row>
            <Row label="Email">{user.email}</Row>
            <Row label="Email đã xác thực">
              {isEmailVerified ? (
                <StatusDotBadge label="Đã xác thực" tone="success" />
              ) : (
                <StatusDotBadge label="Chưa xác thực" tone="warning" />
              )}
            </Row>
            {user.email_verified_at && (
              <Row label="Xác thực lúc">{formatDateTime(user.email_verified_at)}</Row>
            )}
            <Row label="Họ tên">{fullName || '-'}</Row>
            <Row label="Điện thoại">{user.phone || '-'}</Row>
            <Row label="Địa chỉ">{addressDetail || '-'}</Row>
            <Row label="Ảnh đại diện">
              {avatarUrl ? (
                <img
                  src={parseLink(avatarUrl)}
                  alt={fullName || 'Ảnh đại diện'}
                  className="h-20 w-20 rounded-full border object-cover"
                />
              ) : (
                '-'
              )}
            </Row>
            <Row label="Vai trò">{roleLabel(user)}</Row>
            {user.role_permissions && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Quyền:</span>
                <PermissionList permissions={user.role_permissions} />
              </div>
            )}
            <Row label="Kích hoạt">
              {isActive ? (
                <StatusDotBadge label="Đang hoạt động" tone="success" />
              ) : (
                <StatusDotBadge label="Ngừng hoạt động" tone="neutral" />
              )}
            </Row>
            <Row label="Nhà cung cấp">{user.provider || '-'}</Row>
            <Row label="Có mật khẩu">
              {hasPassword ? (
                <StatusDotBadge label="Có" tone="success" />
              ) : (
                <StatusDotBadge label="Cần đổi mật khẩu" tone="warning" />
              )}
            </Row>
            {user.password_changed_at && (
              <Row label="Đổi mật khẩu lúc">{formatDateTime(user.password_changed_at)}</Row>
            )}
            <Row label="Đăng nhập lần cuối">{lastLoginAt ? formatDateTime(lastLoginAt) : '-'}</Row>
            {user.last_login_ip && <Row label="IP đăng nhập cuối">{user.last_login_ip}</Row>}
            <Row label="Ngày tạo">{createdAt ? formatDateTime(createdAt) : '-'}</Row>
            <Row label="Cập nhật">{updatedAt ? formatDateTime(updatedAt) : '-'}</Row>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
