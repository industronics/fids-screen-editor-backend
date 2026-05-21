import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { UserAuthModule } from '@industronics/remote-auth'
import { ClsModule } from 'nestjs-cls'
import { AssetsModule } from './assets/assets.module'
import { HealthModule } from './health/health.module'
import { TemplatesModule } from './templates/templates.module'
import { RemarkStylesModule } from './remark-styles/remark-styles.module'

/**
 * AppModule — composition root. Loads .env globally, opens a Mongoose
 * connection to the local-Docker Mongo simulating on-prem, and wires
 * the health module so we can verify both the HTTP server and the DB
 * are reachable.
 *
 * Domain modules (templates, assets, renderer) plug in as siblings as
 * they get built.
 */
@Module({
  imports: [
    // ClsModule must mount before UserAuthModule because the package's
    // UserJwtStrategy.validate() calls cls.set('userId', ...) and needs
    // an active CLS context on every request.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Cloud and on-prem each get their own Mongo database so that
        // asset records can never reference bytes that don't exist in
        // the active storage backend. In production each deployment
        // already has its own Mongo instance, so this only matters for
        // local dev where both modes hit the same server — but the
        // override (MONGO_DB_NAME) lets prod pin an explicit name.
        const explicit = config.get<string>('MONGO_DB_NAME')
        const mode = (config.get<string>('DEPLOYMENT_MODE') ?? '')
          .trim()
          .toLowerCase()
        const isOnPrem = mode === 'on-prem' || mode === 'onprem'
        const dbName = explicit || (isOnPrem ? 'screen-editor-onprem' : 'screen-editor-cloud')
        return {
          uri: config.get<string>('MONGO_URI'),
          dbName,
        }
      },
    }),
    UserAuthModule,
    HealthModule,
    TemplatesModule,
    AssetsModule,
    RemarkStylesModule,
  ],
})
export class AppModule {}
