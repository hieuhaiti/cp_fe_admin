import { describe, expect, it } from 'vitest'
import {
  cleanStyleObject,
  getStyleDefinitions,
  normalizeGeometryCategory,
  parseStyleJson,
  stringifyStyle,
} from './mapLayerStyle'

describe('mapLayerStyle', () => {
  describe('normalizeGeometryCategory', () => {
    it('maps various geometry strings correctly', () => {
      expect(normalizeGeometryCategory('POLYGON')).toBe('polygon')
      expect(normalizeGeometryCategory('MULTIPOLYGON')).toBe('polygon')
      expect(normalizeGeometryCategory('LINESTRING')).toBe('line')
      expect(normalizeGeometryCategory('POINT')).toBe('point')
      expect(normalizeGeometryCategory('RASTER')).toBe('raster')
      expect(normalizeGeometryCategory('GEOTIFF')).toBe('raster')
      expect(normalizeGeometryCategory(null)).toBe('other')
    })
  })

  describe('getStyleDefinitions', () => {
    it('returns polygon definitions with fillColor', () => {
      const defs = getStyleDefinitions('POLYGON')
      expect(defs.some((d) => d.key === 'fillColor')).toBe(true)
      expect(defs.some((d) => d.key === 'fillOpacity')).toBe(true)
    })

    it('returns line definitions with strokeWidth', () => {
      const defs = getStyleDefinitions('LINESTRING')
      expect(defs.some((d) => d.key === 'strokeWidth')).toBe(true)
      expect(defs.some((d) => d.key === 'strokeColor')).toBe(true)
    })

    it('returns point definitions with circleRadius', () => {
      const defs = getStyleDefinitions('POINT')
      expect(defs.some((d) => d.key === 'circleRadius')).toBe(true)
    })
  })

  describe('cleanStyleObject', () => {
    it('strips empty strings, null, and undefined values upon payload building', () => {
      const input = {
        fillColor: '',
        fillOpacity: 0.8,
        strokeColor: undefined,
        strokeWidth: null,
      }
      expect(cleanStyleObject(input)).toEqual({
        fillOpacity: 0.8,
      })
    })

    it('preserves false and 0 numbers correctly', () => {
      const input = {
        strokeWidth: 0,
        fillAntialias: false,
        visible_by_default: false,
        emptyField: '',
      }
      expect(cleanStyleObject(input)).toEqual({
        strokeWidth: 0,
        fillAntialias: false,
        visible_by_default: false,
      })
    })

    it('returns null if object has no non-empty values', () => {
      expect(cleanStyleObject({})).toBeNull()
      expect(cleanStyleObject({ a: '', b: null, c: undefined })).toBeNull()
      expect(cleanStyleObject(null)).toBeNull()
    })
  })

  describe('parseStyleJson', () => {
    it('parses valid json object', () => {
      const res = parseStyleJson('{"fillColor": "#FF0000"}')
      expect(res.style).toEqual({ fillColor: '#FF0000' })
      expect(res.error).toBeUndefined()
    })

    it('returns error when json is invalid syntax', () => {
      const res = parseStyleJson('{not-json}')
      expect(res.style).toBeNull()
      expect(res.error).toBeDefined()
    })

    it('returns error when json is an array', () => {
      const res = parseStyleJson('[1, 2, 3]')
      expect(res.style).toBeNull()
      expect(res.error).toBe('Cấu hình kiểu vẽ phải là một đối tượng JSON hợp lệ {}.')
    })

    it('returns null style for blank text', () => {
      expect(parseStyleJson('').style).toBeNull()
      expect(parseStyleJson('   ').style).toBeNull()
    })
  })

  describe('stringifyStyle', () => {
    it('stringifies object with indentation', () => {
      expect(stringifyStyle({ a: 1 })).toBe('{\n  "a": 1\n}')
    })

 it('returns empty string for null or empty object', () => {
 expect(stringifyStyle(null)).toBe('')
 expect(stringifyStyle({})).toBe('')
 })
 })
})