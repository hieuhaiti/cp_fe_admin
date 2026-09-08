import { describe, expect, it } from 'vitest'
import { navConfig } from '@/constant/common'
import { adminPageContracts } from '@/test/adminPageContractMatrix'

describe('Admin RBAC vocabulary matches Server routes and reviewed matrix', () => {
  it('uses Server resource/action keys for protected Admin pages', () => {
    const byPage = new Map(adminPageContracts.map((page) => [page.page, page.routePermission]))
    expect(byPage.get('MapLayers')).toBe('layers:read')
    expect(byPage.get('MapLayerApis')).toBe('api_registry:read')
    expect(byPage.get('KttvScenarios')).toBe('flood:read')
    expect(byPage.get('Feedback')).toBe('field_report:read')
    expect(byPage.get('NewsComments')).toBe('news:update')
  })

  it('only uses Server-known permission resources in navigation', () => {
    const serverResources = new Set([
      'layers',
      'raster',
      'api_registry',
      'pdf_maps',
      'documents',
      'forest_classification',
      'flood',
      'news',
      'field_report',
      'users',
    ])
    const resources = navConfig.flatMap((item) => [
      ...(item.permission ? [item.permission.resource] : []),
      ...(item.subItems ?? []).flatMap((sub) => (sub.permission ? [sub.permission.resource] : [])),
    ])

    expect(resources.length).toBeGreaterThan(0)
    for (const resource of resources) {
      expect(serverResources.has(resource)).toBe(true)
    }
  })
})
