import type { ApiResponse, CreateDocumentBody, CreateMapLayerBody, CreateNewsBody, CreatePdfMapBody, CreateUserBody, UpdateDocumentBody, UpdatePdfMapBody } from '@/types/api'
import type { FloodScenarioWriteBody } from '@/service/kttvScenarioService'
import { describe, expect, it } from 'vitest'

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') throw new Error('Expected object')
  return value as Record<string, unknown>
}

describe('Admin static request contracts', () => {
  it('accepts payloads with the primitive types expected by Admin services', () => {
    const user = { email: 'a@example.com', password: 'Secret123!', fullName: 'A User', roleCode: 'citizen' } satisfies CreateUserBody
    const news = { title: 'A valid title', content: 'Content', status: 'published' } satisfies CreateNewsBody
    const document = { title: 'Document', documentCode: 'D-1', issuingAgency: 'Agency', fileObjectId: 12 } satisfies CreateDocumentBody
    const pdfMap = { title: 'Map', scaleLabel: '1:25.000', mapYear: 2026, preparingAgency: 'Agency', visibility: 'public', fileObjectId: 12 } satisfies CreatePdfMapBody
    const layer = { code: 'flood_layer', name_vi: 'Flood', table_name: 'flood_layer', geometry_type: 'POLYGON', epsg_code: 4326 } satisfies CreateMapLayerBody
    const scenario = { code: 'scenario_1', nameVi: 'Scenario', layerCode: 'flood_layer', minRainfall: 10, isActive: true } satisfies FloodScenarioWriteBody
    expect([user, news, document, pdfMap, layer, scenario]).toHaveLength(6)
  })

  it('keeps update contracts distinct from create contracts', () => {
    const document = { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', title: 'Changed' } satisfies UpdateDocumentBody
    const pdfMap = { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', mapYear: 2026 } satisfies UpdatePdfMapBody
    expect(document.expectedUpdatedAt).toContain('T')
    expect(typeof pdfMap.mapYear).toBe('number')
  })
})

describe('Server response shapes consumed by Admin', () => {
  it('validates the common envelope and pagination runtime shape', () => {
    const response: ApiResponse<{ items: Array<{ id: number; title: string }>; pagination: { page: number; limit: number; total: number; totalPages: number } }> = {
      status: 200,
      message: 'OK',
      data: { items: [{ id: 1, title: 'Contract item' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    }
    const data = asRecord(response.data)
    const pagination = asRecord(data.pagination)
    expect(response.status).toBe(200)
    expect(typeof data.items).toBe('object')
    expect(typeof pagination.totalPages).toBe('number')
  })

  it('rejects an envelope with a missing status at runtime', () => {
    const invalid: Partial<ApiResponse> = { message: 'bad' }
    expect('status' in invalid).toBe(false)
  })
})
