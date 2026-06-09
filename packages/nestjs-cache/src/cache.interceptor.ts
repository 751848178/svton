import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Reflector } from '@nestjs/core';
import { Observable, of, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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

    const cacheableOpts = this.reflector.get<CacheableOptions>(CACHEABLE_METADATA, handler);
    if (cacheableOpts) {
      return this.handleCacheable(context, next, cacheableOpts);
    }

    const evictOpts = this.reflector.get<CacheEvictOptions>(CACHE_EVICT_METADATA, handler);
    if (evictOpts) {
      return this.handleCacheEvict(context, next, evictOpts);
    }

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
    const ttl = options.ttl ?? this.options?.ttl ?? 3600;

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
          switchMap((result) =>
            from(this.writeCacheValue(cacheKey, result, ttl)).pipe(map(() => result)),
          ),
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
    const cachePattern = this.buildCachePattern(context, options.key);

    const evict = async () => {
      if (options.allEntries) {
        await this.deleteByPattern(cachePattern);
        return;
      }

      await this.redis.del(cacheKey);
    };

    if (options.beforeInvocation) {
      return from(evict()).pipe(switchMap(() => next.handle()));
    }

    return next.handle().pipe(
      switchMap((result) => from(evict()).pipe(map(() => result))),
    );
  }

  private handleCachePut(
    context: ExecutionContext,
    next: CallHandler,
    options: CachePutOptions,
  ): Observable<unknown> {
    const cacheKey = this.buildCacheKey(context, options.key);
    const ttl = options.ttl ?? this.options?.ttl ?? 3600;

    return next.handle().pipe(
      switchMap((result) =>
        from(this.writeCacheValue(cacheKey, result, ttl)).pipe(map(() => result)),
      ),
    );
  }

  private buildCacheKey(context: ExecutionContext, keyTemplate?: string): string {
    const prefix = this.options?.prefix ?? 'cache';
    const className = context.getClass().name;
    const methodName = context.getHandler().name;

    if (!keyTemplate) {
      const namespace = `${prefix}:${className}:${methodName}`;
      const signature = this.buildRequestSignature(context);
      return signature ? `${namespace}:${signature}` : namespace;
    }

    return `${prefix}:${this.resolveKeyTemplate(context, keyTemplate)}`;
  }

  private buildCachePattern(context: ExecutionContext, keyTemplate?: string): string {
    const prefix = this.options?.prefix ?? 'cache';

    if (keyTemplate) {
      return `${prefix}:${this.resolveKeyTemplate(context, keyTemplate)}`;
    }

    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    return `${prefix}:${className}:${methodName}*`;
  }

  private resolveKeyTemplate(context: ExecutionContext, keyTemplate: string): string {
    const args = context.getArgs();
    const request = args[0] as RequestLike | undefined;

    return keyTemplate.replace(/#([A-Za-z0-9_.]+)/g, (match, expression) => {
      const value = this.resolveExpressionValue(expression, args, request);
      return value === undefined ? match : this.serializeKeyPart(value);
    });
  }

  private resolveExpressionValue(
    expression: string,
    args: unknown[],
    request?: RequestLike,
  ): unknown {
    const [root, ...rest] = expression.split('.');

    if (/^\d+$/.test(root)) {
      return this.getNestedValue(args[parseInt(root, 10)], rest);
    }

    for (const source of [request?.params, request?.body, request?.query]) {
      const value = this.getNestedValue(source, [root, ...rest]);
      if (value !== undefined) {
        return value;
      }
    }

    for (const arg of args) {
      const value = this.getNestedValue(arg, [root, ...rest]);
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private getNestedValue(source: unknown, path: string[]): unknown {
    if (!source) {
      return undefined;
    }

    let current: unknown = source;
    for (const segment of path) {
      if (!segment) {
        continue;
      }

      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
        continue;
      }

      return undefined;
    }

    return current;
  }

  private serializeKeyPart(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return this.stableStringify(value);
  }

  private buildRequestSignature(context: ExecutionContext): string | undefined {
    const args = context.getArgs();
    const request = args[0] as RequestLike | undefined;

    const payload =
      request && typeof request === 'object'
        ? this.compactValue({
            params: request.params,
            query: request.query,
            body: request.body,
          })
        : undefined;

    const fallback = !payload && args.length > 0 ? this.compactValue({ args }) : undefined;
    const content = payload ?? fallback;

    if (!content || (typeof content === 'object' && Object.keys(content).length === 0)) {
      return undefined;
    }

    return createHash('sha1').update(this.stableStringify(content)).digest('hex');
  }

  private compactValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.compactValue(item))
        .filter((item) => item !== undefined);
      return items.length > 0 ? items : undefined;
    }

    if (value && typeof value === 'object') {
      const compacted = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
        (result, [key, item]) => {
          const nextValue = this.compactValue(item);
          if (nextValue !== undefined) {
            result[key] = nextValue;
          }
          return result;
        },
        {},
      );

      return Object.keys(compacted).length > 0 ? compacted : undefined;
    }

    if (value === undefined) {
      return undefined;
    }

    return value;
  }

  private stableStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    return JSON.stringify(value, (_, currentValue) => {
      if (!currentValue || typeof currentValue !== 'object') {
        return currentValue;
      }

      if (seen.has(currentValue)) {
        return '[Circular]';
      }
      seen.add(currentValue);

      if (Array.isArray(currentValue)) {
        return currentValue;
      }

      return Object.keys(currentValue as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = (currentValue as Record<string, unknown>)[key];
          return result;
        }, {});
    });
  }

  private async writeCacheValue(cacheKey: string, result: unknown, ttl: number): Promise<void> {
    const value = typeof result === 'string' ? result : JSON.stringify(result);

    if (ttl > 0) {
      await this.redis.setex(cacheKey, ttl, value);
      return;
    }

    await this.redis.set(cacheKey, value);
  }

  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

interface RequestLike {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}
