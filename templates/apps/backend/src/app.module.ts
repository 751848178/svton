import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

// Svton 基础设施包（按需启用）
// import { createZodValidate } from '@svton/nestjs-config-schema';
// import { HttpModule } from '@svton/nestjs-http';
// import { LoggerModule } from '@svton/nestjs-logger';
// import { RedisModule } from '@svton/nestjs-redis';
// import { AuthzModule } from '@svton/nestjs-authz';
// import { ObjectStorageModule } from '@svton/nestjs-object-storage';
// import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';
// import { envSchema } from './config/env.schema';

@Module({
  imports: [
    // 配置模块（可启用 schema 验证）
    ConfigModule.forRoot({
      isGlobal: true,
      // validate: createZodValidate(envSchema),
    }),

    // HTTP 规范化（统一响应/异常格式）
    // HttpModule.forRoot({
    //   successCode: 0,
    //   successMessage: 'success',
    //   excludePaths: ['/health', '/api-docs'],
    // }),

    // 日志模块
    // LoggerModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     appName: 'backend',
    //     env: config.get('NODE_ENV'),
    //     prettyPrint: config.get('NODE_ENV') !== 'production',
    //   }),
    // }),

    // Redis 模块
    // RedisModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     url: config.get('REDIS_URL'),
    //     keyPrefix: 'app:',
    //   }),
    // }),

    // RBAC 权限模块
    // AuthzModule.forRoot({
    //   userRoleField: 'role',
    //   enableGlobalGuard: false,
    // }),

    // 对象存储模块（七牛云示例）
    // ObjectStorageModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     defaultBucket: config.get('QINIU_BUCKET'),
    //     publicBaseUrl: config.get('QINIU_CDN_URL'),
    //     adapter: createQiniuAdapter({
    //       accessKey: config.get('QINIU_ACCESS_KEY'),
    //       secretKey: config.get('QINIU_SECRET_KEY'),
    //       bucket: config.get('QINIU_BUCKET'),
    //       region: config.get('QINIU_REGION'),
    //       publicDomain: config.get('QINIU_CDN_URL'),
    //     }),
    //   }),
    // }),

    PrismaModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
