import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { LoggerModuleOptions, LoggerModuleAsyncOptions } from './interfaces';
import { AliyunSlsTransport } from './transports/aliyun-sls.transport';
import { TencentClsTransport } from './transports/tencent-cls.transport';
import * as pino from 'pino';

@Module({})
export class LoggerModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    return {
      module: LoggerModule,
      imports: [PinoLoggerModule.forRoot(this.createPinoConfig(options))],
      exports: [PinoLoggerModule],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          imports: options.imports,
          inject: options.inject,
          useFactory: async (...args: unknown[]) => {
            let moduleOptions: LoggerModuleOptions = {};

            if (options.useFactory) {
              moduleOptions = await options.useFactory(...args);
            }

            return this.createPinoConfig(moduleOptions);
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }

  private static createPinoConfig(options: LoggerModuleOptions) {
    const {
      appName = 'app',
      env = process.env.NODE_ENV || 'development',
      level = env === 'production' ? 'info' : 'debug',
      prettyPrint = env !== 'production',
      excludeRoutes = ['/health', '/metrics', '/favicon.ico'],
      autoRequestId = true,
      requestIdHeader = 'x-request-id',
      customProps,
      logRequestBody = false,
      logResponseBody = false,
      cloudLogger,
    } = options;

    // 创建云日志 transport streams
    const streams: pino.StreamEntry<pino.Level>[] = [];

    // 标准输出 stream
    if (prettyPrint) {
      streams.push({
        level: level as pino.Level,
        stream: pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }),
      });
    } else {
      streams.push({
        level: level as pino.Level,
        stream: process.stdout,
      });
    }

    // 阿里云 SLS stream
    if (cloudLogger?.aliyunSls) {
      streams.push({
        level: level as pino.Level,
        stream: new AliyunSlsTransport(cloudLogger.aliyunSls),
      });
    }

    // 腾讯云 CLS stream
    if (cloudLogger?.tencentCls) {
      streams.push({
        level: level as pino.Level,
        stream: new TencentClsTransport(cloudLogger.tencentCls),
      });
    }

    return {
      pinoHttp: {
        level,
        genReqId: autoRequestId
          ? (req: { headers: Record<string, string | string[] | undefined> }) =>
              (req.headers[requestIdHeader] as string) || randomUUID()
          : undefined,
        customProps: (req: unknown) => ({
          app: appName,
          env,
          ...(customProps?.(req) || {}),
        }),
        autoLogging: {
          ignore: (req: { url?: string }) =>
            excludeRoutes.some((route) => req.url?.startsWith(route)),
        },
        serializers: {
          req: (req: { id?: string; method?: string; url?: string; headers?: Record<string, unknown> }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            ...(logRequestBody && { body: (req as unknown as { raw?: { body?: unknown } }).raw?.body }),
          }),
          res: (res: { statusCode?: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        // 使用 multistream 支持多个输出目标
        stream: streams.length > 1 ? pino.multistream(streams) : streams[0].stream,
      },
    };
  }
}
