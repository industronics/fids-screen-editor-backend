import { AuthRequest } from '@industronics/remote-auth'
import { Types, isValidObjectId } from 'mongoose'

/**
 * Scoped query helpers. The active scope (req.scope) reflects which
 * tenant the user is currently *acting as* — for super-admins that's
 * the airport they picked in the context switcher, for tenant-scoped
 * users it's their (only) membership. Queries always honour the picked
 * scope; super-admin power is expressed by their ability to switch
 * scopes, not by ignoring the current one.
 */
export function buildScopedQuery(
  req: AuthRequest,
  id?: string | Types.ObjectId,
): Record<string, unknown> {
  const condition: Record<string, unknown> = {
    isActive: true,
    ownerType: req.scope.ownerType,
    ownerId: req.scope.ownerId,
  }
  if (id && isValidObjectId(id)) {
    condition._id = new Types.ObjectId(id as string)
  }
  return condition
}

/**
 * List queries — same scope rule plus an isPublic OR clause so
 * cross-tenant read-only exposure works (precedent: DCMM Advertisement
 * / Announcement). isPublic templates from other tenants still show
 * up, owned templates are pinned to the active scope.
 */
export function buildScopedListQuery(req: AuthRequest): Record<string, unknown> {
  return {
    isActive: true,
    $or: [
      { isPublic: true },
      { ownerType: req.scope.ownerType, ownerId: req.scope.ownerId },
    ],
  }
}
