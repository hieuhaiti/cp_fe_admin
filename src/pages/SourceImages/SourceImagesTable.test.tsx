import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceImagesTable } from './SourceImagesTable'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { LayerLifecycleInfo, SatelliteImageMember } from '@/types/api'

describe('SourceImagesTable status presentation', () => {
  it.each([
    [null, 'none', 'Đang hoạt động: test_layer', false],
    ['2026-10-01', 'complete', 'Đã dọn lớp: test_layer', false],
    ['2026-10-01', 'queued', 'Đang dọn (test_layer)', true],
    ['2026-10-01', 'running', 'Đang dọn (test_layer)', true],
    ['2026-10-01', 'failed', 'Dọn dẹp thất bại (test_layer)', true],
    ['2026-10-01', 'none', 'Đã xóa: test_layer', false],
  ] as const)('keeps lifecycle %s/%s and callback unchanged', (deletedAt, cleanupStatus, label, actionable) => {
    const onViewCleanup = vi.fn()
    const layer: LayerLifecycleInfo = { id: 12, code: 'test_layer', deletedAt, cleanupStatus }
    const image = { id: 1, scene_code: 'scene', title: 'Ảnh thử nghiệm', platform: 'Sentinel-2', coverage_key: 'group', acquired_at: '2026-10-01', created_at: '2026-10-01', updated_at: '2026-10-01', standaloneLayer: layer } as SatelliteImageMember
    const { container } = renderWithProviders(<SourceImagesTable items={[image]} loading={false} canPublish={false} canCreate={false} canDelete={false} onRepublish={vi.fn()} onChangeGroup={vi.fn()} onViewCleanup={onViewCleanup} onDelete={vi.fn()} />)
    const badge = screen.getByText(label).closest('[data-status-dot-badge]')!
    expect(badge.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    if (actionable) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(onViewCleanup).toHaveBeenCalledWith(12)
      expect(badge).not.toHaveAttribute('tabindex')
    } else {
      expect(onViewCleanup).not.toHaveBeenCalled()
    }
    expect(container.querySelector('button[aria-label="Xóa ảnh"]')).not.toBeInTheDocument()
  })
})
