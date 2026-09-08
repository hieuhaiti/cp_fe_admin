import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminOperationContracts, adminPageContracts } from './adminPageContractMatrix'

const expectedPageDirectories = [
  'ChangePassword',
  'Dashboard',
  'Documents',
  'Errors',
  'Feedback',
  'FieldMeasurements',
  'FireRisk',
  'Flood',
  'ForestClassification',
  'KttvScenarios',
  'Landing',
  'LayerSeries',
  'Login',
  'MapImage',
  'MapLayerApis',
  'MapLayers',
  'MonitoredAreas',
  'News',
  'NewsComments',
  'NotificationSend',
  'Profile',
  'TimeSeries',
  'User',
] as const

const expectedAppRoutes = [
  '/',
  '/dashboard',
  '/users',
  '/news',
  '/news-comments',
  '/map-layers',
  '/map-layers/time-series',
  '/map-layers/import-geojson',
  '/map-apis/*',
  '/map-layer-apis/*',
  '/public/map-apis',
  '/public/map-layer-apis',
  '/map-images',
  '/documents',
  '/forest-classification',
  '/flood',
  '/kttv-scenarios',
  '/feedbacks',
  '/profile',
  '/change-password',
  '/login',
  '/400',
  '/401',
  '/403',
  '/500',
  '/503',
  '*',
] as const

describe('Admin page coverage matrix', () => {
  it('tracks every page source module, including root and empty legacy modules', () => {
    expect(adminPageContracts.map((page) => page.page).sort()).toEqual(
      [...expectedPageDirectories].sort()
    )
  })

  it('tracks every mounted route in App', () => {
    const routes = adminPageContracts.flatMap((page) => page.routes)
    expect(new Set(routes)).toEqual(new Set(expectedAppRoutes))
  })

  it('classifies every non-empty page with a test target and form modes', () => {
    for (const page of adminPageContracts) {
      expect(page.formModes.length, `${page.page} form mode`).toBeGreaterThan(0)
      if (page.mountStatus !== 'empty') {
        expect(page.sourceFiles.length, `${page.page} source`).toBeGreaterThan(0)
        expect(page.testFiles.length, `${page.page} test target`).toBeGreaterThan(0)
      }
    }
  })

  it('requires every declared source and test target to exist on disk', () => {
    const pageRoot = resolve(process.cwd(), 'src/pages')
    for (const page of adminPageContracts) {
      for (const sourceFile of page.sourceFiles) {
        expect(existsSync(resolve(pageRoot, sourceFile)), `${page.page} source: ${sourceFile}`).toBe(true)
      }
      for (const testFile of page.testFiles) {
        expect(existsSync(resolve(pageRoot, testFile)), `${page.page} test: ${testFile}`).toBe(true)
      }
    }
  })

  it('requires service, HTTP and Server contract mapping for every resolved mutation', () => {
    for (const contract of adminOperationContracts) {
      if (contract.unresolved) {
        expect(contract.unresolved, `${contract.id} unresolved reason`).toBeTruthy()
        expect(contract.service, `${contract.id} frontend service`).toBeTruthy()
        expect(contract.path, `${contract.id} frontend path`).toMatch(/^\//)
        continue
      }
      expect(contract.service, `${contract.id} service`).toBeTruthy()
      expect(contract.method, `${contract.id} method`).toBeTruthy()
      expect(contract.path, `${contract.id} path`).toMatch(/^\//)
      expect(contract.serverRoute, `${contract.id} server route`).toMatch(/\.routes\.js$/)
    }
  })

  it('does not silently duplicate operation ids', () => {
    const ids = adminOperationContracts.map((contract) => contract.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps Admin route and operation permission vocabulary aligned with Server', () => {
    const byPage = new Map(adminPageContracts.map((page) => [page.page, page]))
    expect(byPage.get('MapLayers')?.routePermission).toBe('layers:read')
    expect(byPage.get('MapLayers')?.operations.find((item) => item.id === 'layer-update')?.permission).toBe('layers:update')
    expect(byPage.get('MapLayerApis')?.routePermission).toBe('api_registry:read')
    expect(byPage.get('MapLayerApis')?.operations.find((item) => item.id === 'map-api-create')?.permission).toBe('api_registry:create')
    expect(byPage.get('KttvScenarios')?.routePermission).toBe('flood:read')
    expect(byPage.get('Feedback')?.routePermission).toBe('field_report:read')
    expect(byPage.get('Feedback')?.operations[0]?.permission).toBe('field_report:approve')
    expect(byPage.get('NewsComments')?.routePermission).toBe('news:update')
  })
})
