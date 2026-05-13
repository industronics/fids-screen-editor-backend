import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import {
  AuthRequest,
  Permissions,
  RequiresScope,
} from '@industronics/remote-auth'
import { Entity, PermissionAction } from '@industronics/fids-utils'
import { AssetsService, type AssetMetaDto } from './assets.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { updateAssetSchema, type UpdateAssetDto } from './dto/update-asset.dto'
import { ASSET_CATEGORIES, type AssetCategory } from '../template-schema/asset'
import {
  ConditionalPermissionGuard,
  ConditionalUserAuthGuard,
} from '../auth/conditional-auth.guards'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB — comfortable for header bmps

// `TemplateEditor` is the closest existing entity in the shared permission
// catalog; the editor's assets are first-class to the template editor. A
// dedicated `AssetLibrary` entity can be added later if the catalog gains
// one.
const ASSET_ENTITY = Entity.TemplateEditor

/**
 * AssetsController — REST surface for uploaded image assets.
 *
 *   POST   /assets               multipart/form-data, returns AssetMetaDto
 *   GET    /assets               full meta list
 *   GET    /assets/:id/raw       streamed bytes with correct Content-Type
 *   PATCH  /assets/:id           rename / recategorize
 *   DELETE /assets/:id           delete meta + bytes
 *
 * The category to apply on upload is read from the `category` query
 * param (e.g. `?category=header`); the editor's picker passes whatever
 * filter is active when the user hits "Upload".
 *
 * Auth note (P2): /assets/:id/raw is intentionally UNGUARDED. Browsers
 * load it from <img src=...> tags and can't attach Authorization
 * headers. Cloud mode already returns a signed GCS URL with embedded
 * auth, so existence is the only practical gate. Revisit if/when raw
 * bytes carry sensitive content — at that point the editor must move
 * to cookie-bearing auth and the controller can be guarded.
 */
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
  @RequiresScope()
  @Permissions(`${ASSET_ENTITY}.${PermissionAction.Read}`)
  @Get()
  list(@Req() req: AuthRequest): Promise<AssetMetaDto[]> {
    return this.assets.list(req)
  }

  @UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
  @RequiresScope()
  @Permissions(`${ASSET_ENTITY}.${PermissionAction.Write}`)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('category') category?: string,
    @Query('sourceRef') sourceRef?: string,
  ): Promise<AssetMetaDto> {
    if (!file) {
      throw new BadRequestException('Expected a multipart/form-data field named "file"')
    }
    const cat = ASSET_CATEGORIES.includes(category as AssetCategory)
      ? (category as AssetCategory)
      : undefined
    return this.assets.upload(req, file, cat, sourceRef)
  }

  // Intentionally unguarded — see controller-header note.
  @Get(':id/raw')
  async raw(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const redirectUrl = await this.assets.getRedirectUrl(id)
    if (redirectUrl) {
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.redirect(302, redirectUrl)
      return
    }
    const result = await this.assets.getStream(id)
    if (!result) throw new NotFoundException(`Asset ${id} not found`)
    res.setHeader('Content-Type', result.mime)
    res.setHeader('Cache-Control', 'public, max-age=300')
    result.stream.pipe(res)
  }

  @UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
  @RequiresScope()
  @Permissions(`${ASSET_ENTITY}.${PermissionAction.Write}`)
  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAssetSchema)) dto: UpdateAssetDto,
  ): Promise<AssetMetaDto> {
    return this.assets.update(req, id, dto)
  }

  @UseGuards(ConditionalUserAuthGuard, ConditionalPermissionGuard)
  @RequiresScope()
  @Permissions(`${ASSET_ENTITY}.${PermissionAction.Delete}`)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthRequest, @Param('id') id: string): Promise<void> {
    await this.assets.remove(req, id)
  }
}
