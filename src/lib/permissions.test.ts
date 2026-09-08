import { describe, expect, it } from 'vitest'
import { ADMIN_PANEL_ROLES, ROLE_BADGE_CLASS, ROLE_LABELS, ROLES, checkPermission, getUserRole, hasAnyPerm, hasPerm, hasRole } from './permissions'
import { cn, isPdf, parseLink } from './utils'

const user = (overrides: Record<string, unknown> = {}) => ({ id: 1, email: 'test@example.com', roleCode: 'citizen', ...overrides }) as never

describe('permission utilities', () => {
  it('resolves roles from roleCode, nested role and missing users', () => {
    expect(getUserRole(null)).toBeNull()
    expect(getUserRole(undefined)).toBeNull()
    expect(getUserRole(user({ roleCode: '', role: { code: 'so_xd' } }))).toBe('so_xd')
    expect(getUserRole(user({ roleCode: 'ubnd_tp' }))).toBe('ubnd_tp')
  })
  it('checks explicit roles and handles missing roles', () => {
    expect(hasRole(null, ADMIN_PANEL_ROLES)).toBe(false)
    expect(hasRole(user({ roleCode: 'so_tnmt' }), ADMIN_PANEL_ROLES)).toBe(true)
    expect(hasRole(user({ roleCode: 'unknown' }), ADMIN_PANEL_ROLES)).toBe(false)
  })
  it('supports explicit object/array permissions and rejects missing permissions without bypass', () => {
    expect(hasPerm(null, 'news', 'read')).toBe(false)
    expect(hasPerm(user({ roleCode: ROLES.SYSTEM_ADMIN, role: { permissions: {} } }), 'anything', 'anything')).toBe(false)
    expect(hasPerm(user({ role: { permissions: { news: { read: true, write: false } } } }), 'news', 'read')).toBe(true)
    expect(hasPerm(user({ role: { permissions: { news: { read: false } } } }), 'news', 'read')).toBe(false)
    expect(hasPerm(user({ role_permissions: { documents: ['read', 'download'] } }), 'documents', 'download')).toBe(true)
    expect(hasPerm(user({ role_permissions: { documents: ['read'] } }), 'documents', 'write')).toBe(false)
    expect(hasPerm(user({ role_permissions: {} }), 'missing', 'read')).toBe(false)
  })

  it('supports any-action and nullable checks', () => {
    const restricted = user({ role_permissions: { map_layers: ['read'] } })
    expect(hasAnyPerm(restricted, 'map_layers', ['write', 'read'])).toBe(true)
    expect(hasAnyPerm(restricted, 'map_layers', ['write'])).toBe(false)
    expect(checkPermission(restricted, null)).toBe(true)
    expect(checkPermission(restricted, { resource: 'map_layers', action: ['write', 'read'] })).toBe(true)
    expect(checkPermission(restricted, { resource: 'map_layers', action: 'write' })).toBe(false)
  })
  it('keeps role labels and badge classes defined', () => {
    for (const role of Object.values(ROLES)) { expect(ROLE_LABELS[role]).toBeTruthy(); expect(ROLE_BADGE_CLASS[role]).toBeTruthy() }
  })
})

describe('shared utility functions', () => {
  it('merges classes and resolves links', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(parseLink('')).toBe('')
    expect(parseLink('https://example.com/file.pdf')).toBe('https://example.com/file.pdf')
    expect(parseLink('/files/a.pdf')).toContain('/files/a.pdf')
    expect(parseLink('files/a.pdf')).toContain('/files/a.pdf')
  })
  it('identifies PDFs safely', () => {
    expect(isPdf('')).toBe(false)
    expect(isPdf('document.PDF')).toBe(true)
    expect(isPdf('document.txt')).toBe(false)
  })
})
