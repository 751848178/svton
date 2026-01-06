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
  code: number;
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
    let code = status;

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
      }
      code = status;
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
