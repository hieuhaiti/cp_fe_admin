import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Clock, KeyRound, Loader2, ShieldCheck, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { mapLayerApiService, useApiMutation } from '@/service'
import type { ApiResponse, IssueKeyBody, MapApiKeyIssueData } from '@/types/api'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'

interface IssueKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registryId: number | string | null
  registryName?: string
  slug?: string
  allowedMethods?: string[]
  onKeyIssued: (data: MapApiKeyIssueData) => void
}

const EXPIRY_PRESETS = [
  { label: '7 ngày', hours: 168 },
  { label: '30 ngày (Mặc định)', hours: 720 },
  { label: '90 ngày', hours: 2160 },
]

export default function IssueKeyDialog({
  open,
  onOpenChange,
  registryId,
  registryName,
  slug,
  allowedMethods,
  onKeyIssued,
}: IssueKeyDialogProps) {
  const [name, setName] = useState('')
  const [consumer, setConsumer] = useState('')
  const [scopes, setScopes] = useState<string[]>(['features:read'])
  const [quotaPerMinute, setQuotaPerMinute] = useState(60)
  const [expiresInHours, setExpiresInHours] = useState(720)

  const methods = allowedMethods || ['GET']
  const canCreate = methods.includes('POST')
  const canUpdate = methods.includes('PUT')
  const canDelete = methods.includes('DELETE')

  useEffect(() => {
    if (open) {
      setScopes(['features:read'])
    }
  }, [open])

  const handleToggleScope = (scope: 'features:read' | 'features:create' | 'features:update' | 'features:delete') => {
    if (scope === 'features:read') return
    if (scopes.includes(scope)) {
      setScopes((prev) => prev.filter((s) => s !== scope))
    } else {
      setScopes((prev) => [...prev, scope])
    }
  }

  const issueMutation = useApiMutation(
    (body: IssueKeyBody) => {
      if (!registryId) throw new Error('Thiếu ID API registry')
      return mapLayerApiService.issueKey(registryId, body)
    },
    {
      onSuccess: (res: ApiResponse<MapApiKeyIssueData>) => {
        toast.success('Cấp khóa thành công!')
        onOpenChange(false)
        setName('')
        setConsumer('')
        if (res.data) {
          onKeyIssued(res.data)
        }
      },
      onError: (err) => {
        toast.error(getMappedErrorMessage(err, 'Không thể cấp khóa mới'))
      },
    },
    false
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên khóa gợi nhớ (tối thiểu 2 ký tự)')
      return
    }
    if (!consumer.trim()) {
      toast.error('Vui lòng nhập tên đơn vị hoặc đối tác sử dụng')
      return
    }
    issueMutation.mutate({
      name: name.trim(),
      consumer: consumer.trim(),
      scopes,
      quotaPerMinute: Number(quotaPerMinute) || 60,
      expiresInHours: Number(expiresInHours) || 720,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Cấp khóa API chia sẻ mới</DialogTitle>
              <DialogDescription>
                Cấp mã truy cập đọc dữ liệu cho đối tác hoặc ứng dụng tích hợp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {registryName && (
          <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
            <span className="text-muted-foreground">API mục tiêu: </span>
            <strong className="text-foreground">{registryName}</strong>
            {slug && (
              <span className="text-muted-foreground ml-1.5 font-mono">
                (/api/v1/shared/{slug}/features)
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="issue-key-name" className="text-xs font-semibold">
              Tên khóa gợi nhớ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="issue-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Khóa tích hợp Cổng thông tin Cẩm Phả"
              className="h-9"
              autoFocus
            />
            <p className="text-muted-foreground text-[11px]">
              Tên để phân biệt mục đích sử dụng của khóa này.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-key-consumer" className="flex items-center gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5 text-primary" />
              Đơn vị / Đối tác sử dụng <span className="text-destructive">*</span>
            </Label>
            <Input
              id="issue-key-consumer"
              value={consumer}
              onChange={(e) => setConsumer(e.target.value)}
              placeholder="VD: Sở Thông tin và Truyền thông, Phòng TN&MT"
              className="h-9"
            />
          </div>

          {/* Phân quyền Scopes của Khóa */}
          <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
            <div>
              <Label className="text-xs font-semibold">Quyền thao tác của khóa truy cập</Label>
              <p className="text-[11px] text-muted-foreground">
                Chọn các quyền cấp cho đối tác này. Các quyền chưa được kích hoạt ở cấu hình API chung sẽ không thể cấp.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50/50 p-2 text-xs dark:border-blue-900/40 dark:bg-blue-950/20">
                <Checkbox checked={true} disabled={true} />
                <div>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">features:read</span>
                  <span className="block text-[10px] text-muted-foreground">Xem dữ liệu (Bắt buộc)</span>
                </div>
              </div>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !canCreate
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : scopes.includes('features:create')
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={scopes.includes('features:create')}
                  disabled={!canCreate}
                  onCheckedChange={() => handleToggleScope('features:create')}
                />
                <div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">features:create</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Thêm mới (POST) {!canCreate && '- API chưa mở'}
                  </span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !canUpdate
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : scopes.includes('features:update')
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={scopes.includes('features:update')}
                  disabled={!canUpdate}
                  onCheckedChange={() => handleToggleScope('features:update')}
                />
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">features:update</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Sửa thông tin (PUT) {!canUpdate && '- API chưa mở'}
                  </span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                  !canDelete
                    ? 'cursor-not-allowed opacity-50 bg-muted/30'
                    : scopes.includes('features:delete')
                      ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
                      : 'hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={scopes.includes('features:delete')}
                  disabled={!canDelete}
                  onCheckedChange={() => handleToggleScope('features:delete')}
                />
                <div>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">features:delete</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Xóa đối tượng (DELETE) {!canDelete && '- API chưa mở'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue-key-quota" className="flex items-center gap-1.5 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Hạn mức truy cập (lượt/phút)
              </Label>
              <Input
                id="issue-key-quota"
                type="number"
                min={1}
                max={1000}
                value={quotaPerMinute}
                onChange={(e) => setQuotaPerMinute(Number(e.target.value))}
                className="h-9 font-mono"
              />
              <p className="text-muted-foreground text-[11px]">Giới hạn từ 1 đến 1.000 lượt/phút.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-key-expiry" className="flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Thời hạn hiệu lực (giờ)
              </Label>
              <Input
                id="issue-key-expiry"
                type="number"
                min={1}
                max={2160}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="h-9 font-mono"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {EXPIRY_PRESETS.map((p) => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setExpiresInHours(p.hours)}
                    className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                      expiresInHours === p.hours
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={issueMutation.isPending} className="gap-1.5">
              {issueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{issueMutation.isPending ? 'Đang cấp khóa...' : 'Cấp khóa'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}