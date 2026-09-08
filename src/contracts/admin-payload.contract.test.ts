import { describe, expect, it } from 'vitest'
import { adminServerContracts } from './contractRegistry'

describe('Admin payload contract metadata', () => {
  it('maps GeoJSON upload fields to the actual multipart payload', () => {
    const contract = adminServerContracts.find((item) => item.dialog === 'GeoTiffUploadDialog')
    expect(contract?.source).toBe('multipart')
    expect(contract?.fields.map((field) => field.server)).toEqual(expect.arrayContaining(['fileObjectId', 'srid']))
  })

  it('resolves Map API and Feedback contracts against their actual Server validators', () => {
    const mapApi = adminServerContracts.find((item) => item.dialog === 'MapLayerApiFormDialog')
    expect(mapApi).toMatchObject({ path: '/admin/api-registry', serverValidator: 'api-registry.registryBody' })
    const feedback = adminServerContracts.find((item) => item.dialog === 'FeedbackUpdateDialog')
    expect(feedback).toMatchObject({ path: '/admin/field-reports/:id/review', serverValidator: 'field-report.reviewSchema' })
    expect(feedback?.fields.map((field) => field.server)).toEqual(expect.arrayContaining(['status', 'reason', 'expectedUpdatedAt']))
  })
})
