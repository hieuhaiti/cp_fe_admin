import { describe, expect, it } from 'vitest'
import {
  buildUpdatePayload,
  getMappedErrorMessage,
  validateCreatePayload,
  validateUpdatePayload,
} from './mapLayerApiValidators'
import {
  inferRegistryFieldConfig,
  toCanonicalCreateBody,
} from '@/service/mapLayerApiService'

describe('mapLayerApiValidators', () => {
  it('accepts and normalizes a valid create payload', () => {
    const result = validateCreatePayload({
      name: '  Flood API  ', layer_id: 4,
      scope: { read: true, rate_per_min: 60 }, is_active: true,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Flood API')
  })

  it('preserves metadata in create payload', () => {
    const metadata = { displayFields: ['code', 'name'], idField: 'id' }
    const result = validateCreatePayload({
      name: 'Flood API with metadata',
      layer_id: 4,
      scope: { read: true, rate_per_min: 60 },
      is_active: true,
      metadata,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata).toEqual(metadata)
    }
  })

  it('rejects too-short names and invalid layer ids with Vietnamese messages', () => {
    const res = validateCreatePayload({ name: 'x', layer_id: 0 } as any)
    expect(res.success).toBe(false)
    if (!res.success) {
      const messages = res.error.issues.map((i) => i.message)
      expect(messages).toContain('Tên gợi nhớ phải có ít nhất 3 ký tự')
      expect(messages).toContain('Vui lòng chọn lớp bản đồ')
    }
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

  it('maps server duplicate field error to Vietnamese message', () => {
    const rawError = {
      body: {
        message: 'Dữ liệu không hợp lệ "readFields[1]" contains a duplicate value "searchFields[1]" contains a duplicate value',
      },
    }
    const msg = getMappedErrorMessage(rawError, 'Lỗi không xác định')
    expect(msg).toBe('Cấu hình trường dữ liệu của lớp bản đồ bị trùng lặp. Vui lòng kiểm tra lại.')
  })
})

describe('mapLayerApiService deduplication', () => {
  it('never produces duplicate readFields or searchFields when metadata is empty', () => {
    const inferred = inferRegistryFieldConfig({
      name: 'Ranh giới',
      layer_id: 1,
    } as any)
    expect(inferred.readFields).toEqual(['name'])
    expect(inferred.searchFields).toEqual(['name'])
    expect(new Set(inferred.readFields).size).toBe(inferred.readFields.length)
    expect(new Set(inferred.searchFields).size).toBe(inferred.searchFields.length)

    const canonical = toCanonicalCreateBody({
      name: 'Ranh giới',
      layer_id: 1,
    } as any)
    expect(canonical.readFields).toEqual(['name'])
    expect(canonical.searchFields).toEqual(['name'])
    expect(new Set(canonical.readFields).size).toBe(canonical.readFields.length)
  })

  it('deduplicates displayFields and searchFields if metadata contains duplicates', () => {
    const inferred = inferRegistryFieldConfig({
      name: 'Ranh giới',
      layer_id: 1,
      metadata: {
        displayFields: ['name', 'name', 'code', 'code'],
        searchFields: ['name', 'name'],
      },
    } as any)
    expect(inferred.readFields).toEqual(['name', 'code'])
    expect(inferred.searchFields).toEqual(['name'])
  })
})

