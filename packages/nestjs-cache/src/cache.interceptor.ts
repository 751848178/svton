import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@svton/nestjs-redis';
import {
  CACHE_OPTIONS,
  CACHEABLE_METADATA,
  CACHE_EVICT_METADATA,
  CACHE_PUT_METADATA,
} from './constants';
import type {
  CacheModuleOptions,
  CacheableOptions,
  CacheEvictOptions,
  CachePutOptions,
} from './interfaces';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() @Inject(CACHE_OPTIONS) private readonly options?: CacheModuleOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.options?.enabled === false) {
      return next.handle();
    }

    const handler = context.getHandler();

    // 检查 @Cacheable
    const cacheableOpts = this.reflector.get<CacheableOptions>(CACHEABLE_METADATA, handler);
    if (cacheableOpts) {
      return this.handleCacheable(context, next, cacheableOpts);
    }

    // 检查 @CacheEvict
    const evictOpts = this.reflector.get<CacheEvictOptions>(CACHE_EVICT_METADATA, handler);
    if (evictOpts) {
      return this.handleCacheEvict(context, next, evictOpts);
    }

    // 检查 @CachePut
    const putOpts = this.reflector.get<CachePutOptions>(CACHE_PUT_METADATA, handler);
    if (putOpts) {
      return this.handleCachePut(context, next, putOpts);
    }

    return next.handle();
  }

  private handleCacheable(
    context: ExecutionContext,
    next: CallHandler,
    options: CacheableOptions,
  ): Observable<unknown> {
    const cacheKey = this.buildCacheKey(context, options.key);

    return from(this.redis.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached !== null) {
          try {
            return of(JSON.parse(cached));
          } catch {
            return of(cached);
          }
        }

        return next.handle().pipe(
          tap((result) => {
            const ttl = options.ttl ?? this.options?.ttl ?? 3600;
            const value = typeof result === 'string' ? result : JSON.stringify(result);
            if (ttl > 0) {
              this.redis.setex(cacheKey, ttl, value);
            } else {
              this.redis.set(cacheKey, value);
            }
          }),
        );
      }),
    );
  }

  private handleCacheEvict(
    context: ExecutionContext,
    next: CallHandler,
    options: CacheEvictOptions,
  ): Observable<unknown> {
    const cacheKey = this.buildCacheKey(context, options.key);

    const evict = async () => {
      if (options.allEntries) {
        const keys = await this.redis.keys(cacheKey);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        await this.redis.del(cacheKey);
      }
    };

    if (options.beforeInvocation) {
      return from(evict()).pipe(switchMap(() => next.handle()));
    }

    return next.handle().pipe(tap(() => evict()));
  }

  private handleCachePut(
    context: ExecutionContext,
    next: CallHandler,
    options: CachePutOptions,
  ): Observable<unknown> {
    const cacheKey = this.buildCacheKey(context, options.key);

    return next.handle().pipe(
      tap((result) => {
        const ttl = options.ttl ?? this.options?.ttl ?? 3600;
        const value = typeof result === 'string' ? result : JSON.stringify(result);
        if (ttl > 0) {
          this.redis.setex(cacheKey, ttl, value);
        } else {
          this.redis.set(cacheKey, value);
        }
      }),
    );
  }

  private buildCacheKey(context: ExecutionContext, keyTemplate?: string): string {
    const prefix = this.options?.prefix ?? 'cache';
    const className = context.getClass().name;
    const methodName = context.getHandler().name;

    if (!keyTemplate) {
      return `${prefix}:${className}:${methodName}`;
    }

    // 解析 #param 风格的表达式
    const args = context.getArgs();
    const request = args[0];
    let key = keyTemplate;

    // 替换 #0, #1 等位置参数
    key = key.replace(/#(\d+)/g, (_, index) => {
      const arg = args[parseInt(index, 10)];
      return arg !== undefined ? String(arg) : '';
    });

    // 替换 #paramName 风格 (从 request.params 或方法参数)
    key = key.replace(/#(\w+)/g, (match, paramName) => {
      // 尝试从 HTTP request params
      if (request?.params?.[paramName] !== undefined) {
        return String(request.params[paramName]);
      }
      // 尝试从 request body
      if (request?.body?.[paramName] !== undefined) {
        return String(request.body[paramName]);
      }
      // 尝试从 request query
      if (request?.query?.[paramName] !== undefined) {
        return String(request.query[paramName]);
      }
      return match;
    });

    return `${prefix}:${key}`;
  }
}
