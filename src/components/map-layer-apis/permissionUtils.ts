import type { User } from '@/types/api'
import { hasPerm } from '@/lib/permissions'

export type MapLayerApiPermissionAction = 'create' | 'update' | 'delete'

/** Mirror `api-registry.routes.js`: CRUD uses create; key rotation uses share separately. */
export function hasMapLayerApiPermission(
  user: User | null,
  action: MapLayerApiPermissionAction
) {
  const serverAction = action === 'create' || action === 'update' || action === 'delete' ? 'create' : action
  return hasPerm(user, 'api_registry', serverAction)
}
