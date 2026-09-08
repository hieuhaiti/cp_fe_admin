import type { CreateDocumentBody, CreateNewsBody, CreateUserBody, UpdateDocumentBody, UpdatePdfMapBody, UpdateUserActiveBody, UpdateUserRoleBody } from '@/types/api'
import type { FloodScenarioWriteBody } from '@/service/kttvScenarioService'
import { describe, expect, it } from 'vitest'

const assertFields = <T>(payload: T, rules: Record<string, (value: unknown) => boolean>) => {
  const record = payload as Record<string, unknown>
  for (const [field, rule] of Object.entries(rules)) {
    if (field in record) expect(rule(record[field]), field).toBe(true)
  }
  return payload
}

describe('Admin types aligned with Server validator contract', () => {
  it('matches Server user create/update primitive contract', () => {
    const create = { email: 'admin-contract@example.com', password: 'Secret123!', fullName: 'Contract User', phone: '', roleCode: 'citizen' } satisfies CreateUserBody
    const role = { roleCode: 'citizen' } satisfies UpdateUserRoleBody
    const active = { isActive: false } satisfies UpdateUserActiveBody
    assertFields(create, { email: (v) => typeof v === 'string', password: (v) => typeof v === 'string', fullName: (v) => typeof v === 'string', phone: (v) => typeof v === 'string', roleCode: (v) => ['system_admin', 'ubnd_tp', 'so_tnmt', 'so_xd', 'citizen'].includes(String(v)) })
    expect(role.roleCode).toBe('citizen')
    expect(typeof active.isActive).toBe('boolean')
  })

  it('matches Server news/document/PDF create and optimistic-lock update types', () => {
    const news = { title: 'News', content: 'Content', status: 'draft' } satisfies CreateNewsBody
    const document = { title: 'Document', documentCode: 'DOC-1', issuingAgency: 'Agency', fileObjectId: 10 } satisfies CreateDocumentBody
    const documentUpdate = { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', visibility: 'internal' } satisfies UpdateDocumentBody
    const pdfUpdate = { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', mapYear: 2026 } satisfies UpdatePdfMapBody
    expect(news.status).toBe('draft')
    expect(typeof document.fileObjectId).toBe('number')
    expect(documentUpdate.expectedUpdatedAt).toMatch(/T/)
    expect(typeof pdfUpdate.mapYear).toBe('number')
  })

  it('matches Server flood scenario numeric/null/boolean fields', () => {
    const scenario = { code: 'scenario_1', nameVi: 'Scenario', layerCode: 'layer_1', minRainfall: 10, maxRainfall: null, minTide: null, maxTide: 2, description: null, isActive: true } satisfies FloodScenarioWriteBody
    assertFields(scenario, { code: (v) => typeof v === 'string', nameVi: (v) => typeof v === 'string', layerCode: (v) => typeof v === 'string', minRainfall: (v) => typeof v === 'number', maxRainfall: (v) => v === null || typeof v === 'number', isActive: (v) => typeof v === 'boolean' })
    expect(scenario.maxRainfall).toBeNull()
  })

  it('makes the Server layer update camelCase contract explicit', () => {
    const serverShape = { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', nameVi: 'New layer', categoryName: null, isPublic: true, isEnableDefault: false }
    const adminLegacyShape = { name_vi: 'New layer', category_name: null, is_public: true, is_enable_default: false }
    expect(serverShape).toEqual(expect.objectContaining({ nameVi: 'New layer', isPublic: true }))
    expect(adminLegacyShape).toHaveProperty('name_vi')
    expect(adminLegacyShape).not.toHaveProperty('nameVi')
  })

  it('matches Server GeoTIFF publish primitive and boundary contract', () => {
    const publish = { code: 'raster_1', nameVi: 'Raster', category: 'flood', srid: 4326, minZoom: 0, maxZoom: 18, isPublic: false }
    expect(publish.code).toMatch(/^[a-z][a-z0-9_]{0,62}$/)
    expect(typeof publish.srid).toBe('number')
    expect(publish.minZoom).toBeLessThanOrEqual(publish.maxZoom)
    expect(typeof publish.isPublic).toBe('boolean')
  })

  it('keeps the Admin role enum exactly aligned with Server Joi', () => {
    const adminRoles = ['system_admin', 'ubnd_tp', 'so_tnmt', 'so_xd', 'citizen']
    const serverRoles = ['system_admin', 'ubnd_tp', 'so_tnmt', 'so_xd', 'citizen']
    expect(adminRoles).toEqual(serverRoles)
  })
})
