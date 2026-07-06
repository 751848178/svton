import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@svton/nestjs-logger';
import { RedisModule } from '@svton/nestjs-redis';
import { CacheModule } from '@svton/nestjs-cache';
import { AuthzModule } from '@svton/nestjs-authz';
import { HttpModule } from '@svton/nestjs-http';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
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
import { ResourceRequestModule } from './resource-request/resource-request.module';
import { ResourceControlModule } from './resource-control/resource-control.module';
import { DeploymentModule } from './deployment/deployment.module';
import { ProjectWebhookModule } from './project-webhook/project-webhook.module';
import { SiteModule } from './site/site.module';
import { ProjectEnvironmentModule } from './project-environment/project-environment.module';
import { ApplicationModule } from './application/application.module';
import { AuditEventModule } from './audit-event/audit-event.module';
import { OperationApprovalModule } from './operation-approval/operation-approval.module';
import { BackupModule } from './backup/backup.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LogCenterModule } from './log-center/log-center.module';
import { ServerExecutorModule } from './server-executor/server-executor.module';
import { ControlAccessPolicyModule } from './control-access-policy';
import { ScheduleModule } from '@nestjs/schedule';
import { CryptoModule } from './common/crypto/crypto.module';
import { LockModule } from './common/lock/lock.module';
import { SshModule } from './common/ssh/ssh.module';
import { ServerExecutorQueueModule } from './server-executor/queue/queue.module';
import { validateEnv } from './common/config/env.schema';
import { useAuthzConfig } from './authz.config';

@Module({
  imports: [
    // 配置模块（启动期用 zod schema 校验所有关键 env，取代散落的手写 Number()/isFinite 钳制）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
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

    // Prisma 数据库模块
    PrismaModule,

    // 统一加解密模块（全局，取代各 service 内复制的 AES 实现）
    CryptoModule,

    // SSH 传输基础设施（取代 ssh-live adapter 的 spawn('ssh') CLI）
    SshModule,

    // 分布式锁（Redis 可用时用 redlock，否则降级 Noop）
    LockModule,

    // Server executor job 队列端口（DB 实现，可替换为 bullmq）
    ServerExecutorQueueModule,

    // 定时任务调度（取代各 scheduler 手写的 setInterval）
    ScheduleModule.forRoot(),

    // RBAC 授权模块
    AuthzModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => useAuthzConfig(prisma),
    }),

    // 统一 HTTP 响应：成功响应封装为 { code, message, data, timestamp }
    // 排除二进制下载（StreamableFile）与 SSE 流式响应，避免被 JSON 信封破坏。
    HttpModule.forRoot({
      successCode: 0,
      successMessage: 'success',
      excludePaths: [
        /^\/api\/projects\/generate$/, // 项目生成 ZIP（StreamableFile，application/zip）
        /^\/api\/projects\/[^/]+\/download$/, // 项目产物下载（StreamableFile）
        /^\/api\/logs\/streams\/[^/]+\/(events|tail)$/, // 日志 SSE 实时推送（text/event-stream）
      ],
    }),

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

    // 项目环境模块
    ProjectEnvironmentModule,

    // 应用服务工作区模块
    ApplicationModule,

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

    // 动态资源申请模块
    ResourceRequestModule,

    // 基础设施资源管控模块
    ResourceControlModule,

    // 项目构建部署模块
    DeploymentModule,

    // 项目 Webhook 模块
    ProjectWebhookModule,

    // 站点管控模块
    SiteModule,

    // 统一审计事件模块
    AuditEventModule,

    // 高风险操作审批模块
    OperationApprovalModule,

    // Server executor 执行治理模块
    ServerExecutorModule,

    // 控制面访问策略模块
    ControlAccessPolicyModule,

    // 资源备份计划模块
    BackupModule,

    // 监控告警模块
    MonitoringModule,

    // 日志中心模块
    LogCenterModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
