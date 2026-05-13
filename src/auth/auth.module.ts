import { Module } from '@nestjs/common'
import {
  ConditionalPermissionGuard,
  ConditionalUserAuthGuard,
} from './conditional-auth.guards'

@Module({
  providers: [ConditionalUserAuthGuard, ConditionalPermissionGuard],
  exports: [ConditionalUserAuthGuard, ConditionalPermissionGuard],
})
export class AuthModule {}
