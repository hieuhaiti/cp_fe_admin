import { describe, expect, it } from 'vitest'
import {
  buildUpdatePayload,
  validateCreatePayload,
  validateUpdatePayload,
} from './mapLayerApiValidators'

describe('mapLayerApiValidators', () => {
  it('accepts and normalizes a valid create payload', () => {
    const result = validateCreatePayload({
      name: '  Flood API  ', layer_id: 4,
      scope: { read: true, rate_per_min: 60 }, is_active: true,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Flood API')
  })

  it('rejects too-short names and invalid layer ids', () => {
    expect(validateCreatePayload({ name: 'x', layer_id: 0 } as any).success).toBe(false)
  })

  it('rejects an empty update payload', () => {
    expect(validateUpdatePayload({} as any).success).toBe(false)
  })

  it('returns only changed normalized fields', () => {
    const payload = buildUpdatePayload(
      { name: 'Old', layer_id: 2, scope: { read: true, rate_per_min: 60 }, is_active: true },
      { name: '  New  ', layer_id: 2, scope: { read: true, rate_per_min: 60 }, is_active: true },
    )
    expect(payload).toEqual({ name: 'New' })
  })
})
