import { useSearchParams } from 'react-router-dom'
import PageLayout from '@/layout/pageLayout'
import PublicSlugTester from '@/components/map-layer-apis/PublicSlugTester'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabValues = ['tester', 'guide'] as const
type PublicTab = (typeof tabValues)[number]

function toValidTab(value: string | null): PublicTab {
  if (!value) return 'tester'
  return (tabValues.includes(value as PublicTab) ? value : 'tester') as PublicTab
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  )
}

function CodeBlock({ children, lang = '' }: { children: string; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-md border bg-slate-950">
      {lang && (
        <div className="border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">{lang}</div>
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-100">{children}</pre>
    </div>
  )
}

function Section({ title, children }: { children: React.ReactNode; title: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export default function MapLayerApiPublicPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = toValidTab(searchParams.get('tab'))

  return (
    <PageLayout title="Kiểm tra Map Data API" description="Kiểm tra API key được cấp">
      <Tabs
        value={currentTab}
        onValueChange={(tab) => {
          setSearchParams({ tab })
        }}
      >
        <TabsList>
          <TabsTrigger value="tester">Test API</TabsTrigger>
          <TabsTrigger value="guide">Hướng dẫn tích hợp</TabsTrigger>
        </TabsList>

        <TabsContent value="tester">
          <PublicSlugTester />
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tổng quan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                API dữ liệu bản đồ cho phép đối tác đọc features GeoJSON của một lớp bản đồ được
                chia sẻ. Mỗi lớp được định danh bằng một <strong className="text-foreground">slug</strong>{' '}
                duy nhất; mỗi đối tác được cấp một{' '}
                <strong className="text-foreground">API key</strong> riêng để xác thực.
              </p>
              <p>
                Key chỉ hiển thị <strong className="text-foreground">một lần</strong> sau khi cấp
                hoặc xoay — hãy lưu lại ngay.
              </p>
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Xác thực</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Dùng header <Code>Authorization: Bearer &lt;token&gt;</Code>. Token là JWT được
                trả về <strong className="text-foreground">một lần duy nhất</strong> khi cấp hoặc
                xoay key qua màn Quản lý Map API — hãy lưu lại ngay.
              </p>
              <CodeBlock lang="HTTP header">
                {`Authorization: Bearer eyJ...`}
              </CodeBlock>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <Section title="1. Lấy danh sách features">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <Code>/api/v1/shared/{'{slug}'}/features</Code>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Tham số (query)</th>
                        <th className="pb-2 pr-4 font-medium">Bắt buộc</th>
                        <th className="pb-2 font-medium">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2 pr-4 font-mono">limit</td>
                        <td className="py-2 pr-4 text-muted-foreground">Không</td>
                        <td className="py-2 text-muted-foreground">Số features trả về — giá trị hợp lệ: <Code>10</Code>, <Code>20</Code>, <Code>50</Code>, <Code>100</Code></td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">page</td>
                        <td className="py-2 pr-4 text-muted-foreground">Không</td>
                        <td className="py-2 text-muted-foreground">Trang (mặc định 1)</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">sortBy</td>
                        <td className="py-2 pr-4 text-muted-foreground">Không</td>
                        <td className="py-2 text-muted-foreground">Tên trường sắp xếp (mặc định <Code>name</Code>)</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">sortOrder</td>
                        <td className="py-2 pr-4 text-muted-foreground">Không</td>
                        <td className="py-2 text-muted-foreground"><Code>ASC</Code> hoặc <Code>DESC</Code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            </CardContent>
          </Card>

          {/* Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ví dụ tích hợp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <Section title="cURL">
                <CodeBlock lang="bash">
                  {`curl -X GET "https://api.campha.vn/api/v1/shared/thuy-loi-cam-pha/features?page=1&limit=50" \\
  -H "Authorization: Bearer eyJ..."`}
                </CodeBlock>
              </Section>

              <Section title="JavaScript / Fetch">
                <CodeBlock lang="javascript">
                  {`const TOKEN = 'eyJ...'; // JWT nhận được khi cấp / xoay key — lưu lại ngay
const SLUG  = 'thuy-loi-cam-pha';
const BASE  = 'https://api.campha.vn/api/v1';

async function getFeatures(page = 1, limit = 50) {
  const params = new URLSearchParams({ page, limit });
  const res = await fetch(\`\${BASE}/shared/\${SLUG}/features?\${params}\`, {
    headers: { 'Authorization': \`Bearer \${TOKEN}\` },
  });
  if (!res.ok) throw new Error(\`Lỗi \${res.status}: \${await res.text()}\`);
  return res.json(); // { type: 'FeatureCollection', features: [...], total, hasMore }
}

const data = await getFeatures(1, 50);
console.log(data.features.length, 'features');`}
                </CodeBlock>
              </Section>

              <Section title="Python (requests)">
                <CodeBlock lang="python">
                  {`import requests

TOKEN = 'eyJ...'  # JWT nhận được khi cấp / xoay key — lưu lại ngay
SLUG  = 'thuy-loi-cam-pha'
BASE  = 'https://api.campha.vn/api/v1'

params  = { 'page': 1, 'limit': 50 }
headers = { 'Authorization': f'Bearer {TOKEN}' }

resp = requests.get(f'{BASE}/shared/{SLUG}/features', params=params, headers=headers)
resp.raise_for_status()

data = resp.json()
print(f"{data['total']} features, trả về {data['returned']}")`}
                </CodeBlock>
              </Section>
            </CardContent>
          </Card>

          {/* Response */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cấu trúc phản hồi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <CodeBlock lang="JSON">
                {`{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [107.35, 21.01] },
      "properties": { "name": "Hồ chứa A", ... }
    }
  ],
  "total": 320,      // tổng số features khớp
  "returned": 100,   // số features trong response này
  "hasMore": true    // còn trang tiếp theo
}`}
              </CodeBlock>
            </CardContent>
          </Card>

          {/* Error codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mã lỗi thường gặp</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">HTTP Status</th>
                      <th className="pb-2 font-medium">Nguyên nhân</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-mono">401</td>
                      <td className="py-2 text-muted-foreground">Thiếu hoặc sai <Code>X-Map-Api-Key</Code></td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono">403</td>
                      <td className="py-2 text-muted-foreground">Key bị thu hồi hoặc hết hạn</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono">404</td>
                      <td className="py-2 text-muted-foreground">Slug không tồn tại hoặc lớp đã bị xóa</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono">429</td>
                      <td className="py-2 text-muted-foreground">Vượt quá giới hạn request/phút của key</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
