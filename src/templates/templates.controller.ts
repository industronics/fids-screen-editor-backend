import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import {
  AuthRequest,
  Permissions,
  RequiresScope,
} from '@industronics/remote-auth'
import { Entity, PermissionAction } from '@industronics/fids-utils'
import { TemplatesService, type SavedTemplateDto, type TemplateMetaDto } from './templates.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  ConditionalPermissionGuard,
  ConditionalUserAuthGuard,
} from '../auth/conditional-auth.guards'
import {
  createTemplateSchema,
  type CreateTemplateDto,
} from './dto/create-template.dto'
import {
  updateTemplateSchema,
  type UpdateTemplateDto,
} from './dto/update-template.dto'
import {
  setStatusSchema,
  type SetStatusDto,
} from './dto/set-status.dto'

/**
 * TemplatesController — REST surface mirroring the editor's local
 * `templateStorage` interface 1:1, so the editor's swap to HTTP is a
 * drop-in adapter swap.
 *
 *   GET    /templates         meta-only list (sorted newest-first)
 *   GET    /templates/:id     full SavedTemplate { meta, template }
 *   POST   /templates         create from { name, body }
 *   PUT    /templates/:id     update name and/or body
 *   DELETE /templates/:id     hard delete
 *
 * Status flip and renderer-fetch endpoints land in their own slices.
 */
@UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
@RequiresScope()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Read}`)
  @Get()
  list(@Req() req: AuthRequest): Promise<TemplateMetaDto[]> {
    return this.templates.list(req)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Read}`)
  @Get(':id')
  getOne(@Req() req: AuthRequest, @Param('id') id: string): Promise<SavedTemplateDto> {
    return this.templates.getOne(req, id)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Write}`)
  @Post()
  @UsePipes()
  create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(createTemplateSchema)) dto: CreateTemplateDto,
  ): Promise<SavedTemplateDto> {
    return this.templates.create(req, dto)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Write}`)
  @Put(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) dto: UpdateTemplateDto,
  ): Promise<SavedTemplateDto> {
    return this.templates.update(req, id, dto)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Write}`)
  @Patch(':id/status')
  setStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setStatusSchema)) dto: SetStatusDto,
  ): Promise<SavedTemplateDto> {
    return this.templates.setStatus(req, id, dto.status)
  }

  @Permissions(`${Entity.TemplateEditor}.${PermissionAction.Delete}`)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthRequest, @Param('id') id: string): Promise<void> {
    await this.templates.remove(req, id)
  }
}
