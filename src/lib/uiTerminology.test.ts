import { describe, expect, it } from 'vitest'
import {
  neutralizeUiMessage,
  formatLifecycleStatus,
  formatModelStatus,
} from './uiTerminology'

describe('uiTerminology helper', () => {
  describe('neutralizeUiMessage', () => {
    it('returns empty string when input is falsy or not a string', () => {
      expect(neutralizeUiMessage('')).toBe('')
      expect(neutralizeUiMessage(null as unknown as string)).toBe('')
      expect(neutralizeUiMessage(undefined as unknown as string)).toBe('')
    })

    it('neutralizes technical terms like coverage_key into user-friendly Vietnamese', () => {
      const input = 'Khóa coverage_key không tồn tại trên hệ thống.'
      const result = neutralizeUiMessage(input)
      expect(result).not.toContain('coverage_key')
      expect(result).toContain('nhóm chuỗi thời gian')
    })

    it('neutralizes GeoServer error messages', () => {
      const input = 'Lỗi kết nối GeoServer layer lop_phu_2025'
      const result = neutralizeUiMessage(input)
      expect(result).not.toContain('GeoServer')
      expect(result).toContain('hệ thống bản đồ')
    })

    it('neutralizes MinIO storage error messages', () => {
      const input = 'MinIO storage bucket not accessible'
      const result = neutralizeUiMessage(input)
      expect(result).not.toContain('MinIO')
      expect(result).toContain('kho lưu trữ dữ liệu')
    })

    it('neutralizes GEE error messages', () => {
      const input = 'Lỗi kết nối GEE compute task'
      const result = neutralizeUiMessage(input)
      expect(result).not.toContain('GEE')
      expect(result).toContain('hệ thống xử lý viễn thám')
    })

    it('translates RASTER_LAYER_CONFLICT code', () => {
      const input = 'Mã lớp đã tồn tại (RASTER_LAYER_CONFLICT)'
      const result = neutralizeUiMessage(input)
      expect(result).not.toContain('RASTER_LAYER_CONFLICT')
      expect(result).toContain('Mã lớp bản đồ bị trùng lặp')
    })
  })

  describe('formatLifecycleStatus', () => {
    it('translates technical cleanup statuses into user-friendly Vietnamese', () => {
      expect(formatLifecycleStatus('cleanup_pending')).toBe('Đang dọn dẹp lớp')
      expect(formatLifecycleStatus('cleanup_failed')).toBe('Dọn dẹp thất bại')
      expect(formatLifecycleStatus('complete')).toBe('Đã hoàn tất')
      expect(formatLifecycleStatus('failed')).toBe('Dọn dẹp thất bại')
      expect(formatLifecycleStatus('queued')).toBe('Đang chờ xử lý')
      expect(formatLifecycleStatus('running')).toBe('Đang xử lý')
      expect(formatLifecycleStatus('active')).toBe('Đang hoạt động')
    })

    it('returns original or empty for undefined', () => {
      expect(formatLifecycleStatus(undefined)).toBe('')
      expect(formatLifecycleStatus('unknown_status')).toBe('unknown_status')
    })
  })

  describe('formatModelStatus', () => {
    it('translates raw backend model statuses into Vietnamese labels', () => {
      expect(formatModelStatus('SUCCEEDED')).toBe('Mô hình hoàn tất')
      expect(formatModelStatus('FAILED')).toBe('Mô hình thất bại')
      expect(formatModelStatus('RUNNING')).toBe('Đang chạy mô hình')
      expect(formatModelStatus('PENDING')).toBe('Chờ thực thi')
    })

    it('returns empty string for nullish values', () => {
      expect(formatModelStatus(null)).toBe('')
      expect(formatModelStatus(undefined)).toBe('')
    })
  })
})
