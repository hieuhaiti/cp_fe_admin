import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MapApiKeyIssueData } from '@/types/api'
import { formatDateTime } from '@/lib/date'

interface TokenIssuedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MapApiKeyIssueData | null
  slug?: string
  isRotation?: boolean
}

export default function TokenIssuedModal({
  open,
  onOpenChange,
  data,
  slug,
  isRotation = false,
}: TokenIssuedModalProps) {
  const navigate = useNavigate()
  const [tokenCopied, setTokenCopied] = useState(false)
  const [curlCopied, setCurlCopied] = useState(false)

  if (!data) return null

  const token = data.token || data.apiKey || data.raw_key || ''
  const apiSlug = slug || data.api?.slug || ''
  const apiUrl = apiSlug
    ? `https://apicampha.tourismpj.pro.vn/api/v1/shared/${apiSlug}/features?limit=10`
    : ''
  const curlCommand = token && apiUrl ? `curl -H "Authorization: Bearer ${token}" "${apiUrl}"` : ''

  const handleCopyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setTokenCopied(true)
      toast.success('Đã sao chép mã Token vào bộ nhớ tạm')
      setTimeout(() => setTokenCopied(false), 2500)
    } catch {
      toast.error('Không thể sao chép tự động')
    }
  }

  const handleCopyCurl = async () => {
    if (!curlCommand) return
    try {
      await navigator.clipboard.writeText(curlCommand)
      setCurlCopied(true)
      toast.success('Đã sao chép lệnh cURL')
      setTimeout(() => setCurlCopied(false), 2500)
    } catch {
      toast.error('Không thể sao chép cURL')
    }
  }

  const handleGoToTester = () => {
    onOpenChange(false)
    const params = new URLSearchParams()
    if (apiSlug) params.set('slug', apiSlug)
    if (token) params.set('token', token)
    navigate(`/public/map-apis?${params.toString()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isRotation ? 'Xoay API Key thành công' : 'Cấp khóa chia sẻ API thành công'}
              </DialogTitle>
              <DialogDescription>
                Khóa truy cập cho đối tác đã được hệ thống kích hoạt.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground block text-xs">Tên khóa</span>
              <span className="font-medium text-foreground">{data.name || 'Khóa chia sẻ'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Đơn vị / Đối tác</span>
              <span className="font-medium text-foreground">{data.consumer || 'Chung'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Hạn mức gọi</span>
              <Badge variant="secondary" className="mt-0.5 font-mono text-xs">
                {data.quota_per_minute ?? 60} req/phút
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Hạn sử dụng</span>
              <span className="text-xs text-foreground">
                {data.expires_at ? formatDateTime(data.expires_at) : 'Vô thời hạn'}
              </span>
            </div>
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Lưu ý bảo mật quan trọng:</p>
              <p className="mt-0.5">
                Chuỗi mã Token dưới đây chỉ được máy chủ hiển thị{' '}
                <strong className="underline">duy nhất một lần</strong> này. Vui lòng sao chép và
                chuyển cho đơn vị đối tác lưu trữ an toàn trước khi đóng hộp thoại.
              </p>
            </div>
          </div>

          {/* Token container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Mã Token truy cập (Bearer Token):
              </label>
              {data.token_hint && (
                <span className="text-muted-foreground font-mono text-xs">
                  Gợi ý nhận diện: <strong>{data.token_hint}</strong>
                </span>
              )}
            </div>
            <div className="relative">
              <pre className="max-h-28 overflow-x-auto rounded-md border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-400 select-all whitespace-pre-wrap break-all">
                {token || 'Không có mã token'}
              </pre>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleCopyToken}
                  className="gap-1.5"
                  variant={tokenCopied ? 'secondary' : 'default'}
                >
                  {tokenCopied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Đã sao chép token</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Sao chép mã Token</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Curl sample */}
          {curlCommand && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium break-words">
                  Ví dụ lệnh gọi cURL (Endpoint:{' '}
                  <code className="text-foreground font-mono break-all">
                    /api/v1/shared/{apiSlug}/features
                  </code>
                  ):
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleCopyCurl}
                  className="h-6 gap-1 text-xs"
                >
                  {curlCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{curlCopied ? 'Đã chép' : 'Chép cURL'}</span>
                </Button>
              </div>
              <pre className="overflow-x-auto rounded border bg-muted/60 p-2.5 font-mono text-[11px] leading-tight text-foreground select-all whitespace-pre-wrap break-all">
                {curlCommand}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleGoToTester} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            <span>Thử nghiệm trong Public Tester</span>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Đã lưu mã khóa / Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}