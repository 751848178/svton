import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { HTTP_MODULE_OPTIONS } from '../constants';
import { isPrismaError, mapPrismaError } from '../utils/prisma-error.util';

interface HttpOptions {
  enableExceptionFilter?: boolean;
  enableResponseInterceptor?: boolean;
  successCode?: number;
  successMessage?: string;
  includeTimestamp?: boolean;
  getTraceId?: (request: unknown) => string | undefined;
  excludePaths?: (string | RegExp)[];
}

interface ApiResponseType<T = unknown> {
  // CR-3-F3：code 允许 string —— 业务异常（如 RELEASE_PLAN_STALE）通过 HttpException
  // 传入字符串 code，filter 需原样透传给前端 classifyReleaseError 读取。
  code: number | string;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}

interface ExpressRequest {
  method: string;
  url: string;
  id?: string;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
}

/**
 * 全局异常过滤器
 * 统一异常响应格式，支持 Prisma 错误映射
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @Optional() @Inject(HTTP_MODULE_OPTIONS) private readonly options?: HttpOptions,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const request = ctx.getRequest<ExpressRequest>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: number | string = status;

    // 处理 HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        if (Array.isArray(resp.message)) {
          message = resp.message.join(', ');
        }
        // CR-3-F3：保留业务字符串 code（如 RELEASE_PLAN_STALE）。
        // 旧实现只读 resp.message，code 恒为 HTTP status 数字 → 前端
        // classifyReleaseError 永远拿不到字符串 code → autoRepreview 不触发。
        if (typeof resp.code === 'string' && resp.code.length > 0) {
          code = resp.code;
        }
      }
      if (typeof code !== 'string') code = status;
    }
    // 处理 Prisma 错误
    else if (isPrismaError(exception)) {
      const prismaError = mapPrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
      code = prismaError.code;
    }
    // 处理普通 Error
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    // 获取 traceId
    const traceId = this.options?.getTraceId?.(request) || request.id;

    const errorResponse: ApiResponseType<null> = {
      code,
      message,
      data: null,
      ...(traceId && { traceId }),
      ...(this.options?.includeTimestamp !== false && { timestamp: new Date().toISOString() }),
    };

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }
}
