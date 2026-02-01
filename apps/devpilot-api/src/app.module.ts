import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@svton/nestjs-logger';
import { RedisModule } from '@svton/nestjs-redis';
import { CacheModule } from '@svton/nestjs-cache';
import { AuthzModule } from '@svton/nestjs-authz';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TeamModule } from './team/team.module';
import { RegistryModule } from './registry/registry.module';
import { GeneratorModule } from './generator/generator.module';
import { ProjectModule } from './project/project.module';
import { ServerModule } from './server/server.module';
import { ProxyConfigModule } from './proxy-config/proxy-config.module';
import { CDNConfigModule } from './cdn-config/cdn-config.module';
import { ResourceModule } from './resource/resource.module';
import { PresetModule } from './preset/preset.module';
import { GitModule } from './git/git.module';
import { AdminModule } from './admin/admin.module';
import { ResourcePoolModule } from './resource-pool/resource-pool.module';
import { DomainModule } from './domain/domain.module';
import { CDNModule } from './cdn/cdn.module';
import { KeyCenterModule } from './key-center/key-center.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // 日志模块
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appName: 'initializer-api',
        env: config.get('NODE_ENV', 'development'),
        level: config.get('LOG_LEVEL', 'debug'),
        prettyPrint: config.get('NODE_ENV') !== 'production',
      }),
    }),

    // Redis 模块（可选，仅在配置了 Redis 时启用）
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.get('REDIS_HOST', 'localhost'),
        port: config.get('REDIS_PORT', 6379),
        password: config.get('REDIS_PASSWORD'),
        db: config.get('REDIS_DB', 0),
      }),
    }),

    // 缓存模块
    CacheModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        enabled: config.get('CACHE_ENABLED', 'true') === 'true',
        ttl: config.get('CACHE_TTL', 300),
        keyPrefix: 'initializer:',
      }),
    }),

    // RBAC 授权模块
    AuthzModule.forRoot({
      userRoleField: 'role',
      enableGlobalGuard: false, // 手动在需要的地方使用
      allowNoRoles: true,
    }),

    // Prisma 数据库模块
    PrismaModule,

    // 认证模块
    AuthModule,

    // 团队模块
    TeamModule,

    // 功能注册表模块
    RegistryModule,

    // 项目生成模块
    GeneratorModule,

    // 项目管理模块
    ProjectModule,

    // 服务器管理模块
    ServerModule,

    // 代理配置模块
    ProxyConfigModule,

    // CDN 配置模块
    CDNConfigModule,

    // 资源凭证管理模块
    ResourceModule,

    // 配置预设模块
    PresetModule,

    // Git 集成模块
    GitModule,

    // 管理员模块
    AdminModule,

    // 资源池管理模块
    ResourcePoolModule,

    // 域名配置模块
    DomainModule,

    // CDN 配置模块
    CDNModule,

    // 密钥中心模块
    KeyCenterModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
