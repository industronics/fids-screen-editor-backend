import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthRequest, Permissions, RequiresScope } from '@industronics/remote-auth'
import { Entity, PermissionAction } from '@industronics/fids-utils'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  ConditionalPermissionGuard,
  ConditionalUserAuthGuard,
} from '../auth/conditional-auth.guards'
import { RemarkStylesService, type RemarkStyleSetDto } from './remark-styles.service'
import { RemarkCatalogService, type RemarkCatalogItem } from './remark-catalog.service'
import {
  createRemarkStyleSetSchema,
  type CreateRemarkStyleSetDto,
  updateRemarkStyleSetSchema,
  type UpdateRemarkStyleSetDto,
} from './dto/upsert-remark-style-set.dto'

/**
 * RemarkStylesController — the colour-config REST surface, owner-scoped.
 * Reuses the TemplateEditor permission entity for now (no separate
 * RemarkStyle permission yet).
 *
 *   GET  /remark-styles/catalog   proxied + cached remark list for the scope
 *   GET  /remark-styles           this scope's named style sets
 *   POST /remark-styles           create a named set
 *   PUT  /remark-styles/:id       update name / entries / isDefault
 *   DELETE /remark-styles/:id     remove a set (promotes a new default)
 */
@UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
@RequiresScope()
@Controller('remark-styles')
export class RemarkStylesController {
  constructor(
    private readonly sets: RemarkStylesService,
    private readonly catalog: RemarkCatalogService,
  ) {}

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Read}`)
  @Get('catalog')
  getCatalog(@Req() req: AuthRequest): Promise<RemarkCatalogItem[]> {
    return this.catalog.getCatalog(req)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Read}`)
  @Get()
  list(@Req() req: AuthRequest): Promise<RemarkStyleSetDto[]> {
    return this.sets.list(req)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Write}`)
  @Post()
  create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(createRemarkStyleSetSchema)) dto: CreateRemarkStyleSetDto,
  ): Promise<RemarkStyleSetDto> {
    return this.sets.create(req, dto)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Write}`)
  @Put(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRemarkStyleSetSchema)) dto: UpdateRemarkStyleSetDto,
  ): Promise<RemarkStyleSetDto> {
    return this.sets.update(req, id, dto)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Delete}`)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthRequest, @Param('id') id: string): Promise<void> {
    await this.sets.remove(req, id)
  }
}
