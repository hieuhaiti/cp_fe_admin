import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
vi.mock('@radix-ui/react-compose-refs', async () => {
  return await import('@/lib/compose-refs')
})

afterEach(() => cleanup())

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
