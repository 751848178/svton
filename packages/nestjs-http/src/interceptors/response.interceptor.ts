import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HTTP_MODULE_OPTIONS } from '../constants';

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
  path: string;
  id?: string;
}

/**
 * 全局响应拦截器
 * 统一成功响应格式
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseType<T>> {
  constructor(
    @Optional() @Inject(HTTP_MODULE_OPTIONS) private readonly options?: HttpOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseType<T>> {
    const request = context.switchToHttp().getRequest<ExpressRequest>();

    // 检查是否排除当前路径
    if (this.shouldExclude(request.path)) {
      return next.handle();
    }

    const traceId = this.options?.getTraceId?.(request) || request.id;

    return next.handle().pipe(
      map((data) => {
        // 如果已经是标准格式，直接返回
        if (this.isApiResponse(data)) {
          return data;
        }

        return {
          code: this.options?.successCode ?? 0,
          message: this.options?.successMessage ?? 'success',
          data,
          ...(traceId && { traceId }),
          ...(this.options?.includeTimestamp !== false && { timestamp: new Date().toISOString() }),
        };
      }),
    );
  }

  private shouldExclude(path: string): boolean {
    if (!this.options?.excludePaths) return false;

    return this.options.excludePaths.some((pattern) => {
      if (typeof pattern === 'string') {
        return path === pattern || path.startsWith(pattern);
      }
      return pattern.test(path);
    });
  }

  private isApiResponse(data: unknown): data is ApiResponseType<T> {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return 'code' in obj && 'message' in obj && 'data' in obj;
  }
}
