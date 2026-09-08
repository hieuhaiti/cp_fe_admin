import { describe, expect, it } from 'vitest'
import { makeFile } from '@/test/fixtures'

describe('file fixtures', () => {
  it('creates a file with deterministic metadata', () => {
    const file = makeFile('map.pdf', 'application/pdf', 20 * 1024 * 1024 + 1)
    expect(file.name).toBe('map.pdf')
    expect(file.type).toBe('application/pdf')
    expect(file.size).toBe(20 * 1024 * 1024 + 1)
  })
})
