import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { TemplateEntity, TemplateSchema } from './schemas/template.schema'
import { TemplatesController } from './templates.controller'
import { TemplatesService } from './templates.service'
import { StorageModule } from '../storage/storage.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    AuthModule,
    StorageModule,
    MongooseModule.forFeature([{ name: TemplateEntity.name, schema: TemplateSchema }]),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
