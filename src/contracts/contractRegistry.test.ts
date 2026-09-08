import { describe, expect, it } from 'vitest'
import { adminServerContracts } from './contractRegistry'

describe('Admin/Server contract registry', () => {
  it('covers all nine admin dialogs', () => {
    expect(adminServerContracts.map((c) => c.dialog)).toEqual(expect.arrayContaining([
      'UserFormDialog', 'NewsFormDialog', 'DocumentFormDialog', 'MapImageFormDialog',
      'MapLayerFormDialog', 'KttvScenarioFormDialog', 'MapLayerApiFormDialog',
      'FeedbackUpdateDialog', 'GeoTiffUploadDialog',
    ]))
    expect(adminServerContracts).toHaveLength(9)
  })

  it('declares endpoint and runtime type metadata for every field', () => {
    for (const contract of adminServerContracts) {
      expect(contract.path).toMatch(/^\//)
      for (const field of contract.fields) {
        expect(field.admin).toBeTruthy()
        expect(field.server).toBeTruthy()
        expect(field.type).toBeTruthy()
        expect(typeof field.required).toBe('boolean')
      }
    }
  })

  it('records known mismatches explicitly', () => {
    expect(adminServerContracts.find((c) => c.dialog === 'UserFormDialog')?.knownMismatches).toEqual(expect.any(Array))
    expect(adminServerContracts.find((c) => c.dialog === 'MapLayerFormDialog')?.knownMismatches).toEqual(expect.any(Array))
  })
})
