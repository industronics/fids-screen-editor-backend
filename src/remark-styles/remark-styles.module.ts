import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  RemarkStyleSetEntity,
  RemarkStyleSetSchema,
} from './schemas/remark-style-set.schema'
import { RemarkStylesController } from './remark-styles.controller'
import { RemarkStylesService } from './remark-styles.service'
import { RemarkCatalogService } from './remark-catalog.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: RemarkStyleSetEntity.name, schema: RemarkStyleSetSchema },
    ]),
  ],
  controllers: [RemarkStylesController],
  providers: [RemarkStylesService, RemarkCatalogService],
  exports: [RemarkStylesService],
})
export class RemarkStylesModule {}
