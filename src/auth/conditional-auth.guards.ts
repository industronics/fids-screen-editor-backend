import { ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import {
  AuthRequest,
  PermissionGuard,
  UserAuthGuard,
} from '@industronics/remote-auth'
import { OwnerType } from '@industronics/fids-utils'
import { Types } from 'mongoose'

/**
 * Feature-flag wrappers around remote-auth's guards. When
 * AUTH_ENABLED !== 'true' both wrappers short-circuit and the
 * UserAuthGuard variant attaches a dev-default scope to the request,
 * keeping the editor frontend functional until P3 wires real login.
 *
 * Flip AUTH_ENABLED=true once SSO is in front of the editor.
 */

function isAuthEnabled(config: ConfigService): boolean {
  return (config.get<string>('AUTH_ENABLED') ?? '').trim().toLowerCase() === 'true'
}

function attachDevScope(req: AuthRequest, config: ConfigService): void {
  const ownerType =
    (config.get<string>('DEV_OWNER_TYPE') as OwnerType) ?? OwnerType.AIRPORT
  const ownerIdRaw = config.get<string>('DEV_OWNER_ID') ?? ''
  const userId = config.get<string>('DEV_USER_ID') ?? ''

  if (!Types.ObjectId.isValid(ownerIdRaw)) {
    throw new Error(
      `DEV_OWNER_ID is not a valid ObjectId: "${ownerIdRaw}"`,
    )
  }

  req.user = {
    userId,
    firstName: 'Dev',
    lastName: 'User',
    email: 'dev@local',
    roleId: '',
    role: null,
    airportName: '',
    isSuperAdmin: true,
    memberships: [
      { ownerType, ownerId: ownerIdRaw, span: 'ALL' as any },
    ],
  }
  req.scope = {
    ownerType,
    ownerId: new Types.ObjectId(ownerIdRaw),
  }
}

@Injectable()
export class ConditionalUserAuthGuard extends UserAuthGuard {
  constructor(private readonly config: ConfigService) {
    super()
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!isAuthEnabled(this.config)) {
      const req = ctx.switchToHttp().getRequest<AuthRequest>()
      attachDevScope(req, this.config)
      return true
    }
    return (await super.canActivate(ctx)) as boolean
  }
}

@Injectable()
export class ConditionalPermissionGuard extends PermissionGuard {
  constructor(
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(reflector)
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!isAuthEnabled(this.config)) return true
    return super.canActivate(ctx)
  }
}
