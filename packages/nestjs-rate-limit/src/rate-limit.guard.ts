import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@svton/nestjs-redis';
import { RATE_LIMIT_OPTIONS, RATE_LIMIT_METADATA, SKIP_RATE_LIMIT } from './constants';
import type { RateLimitModuleOptions, RateLimitConfig, RateLimitInfo } from './interfaces';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() @Inject(RATE_LIMIT_OPTIONS) private readonly options?: RateLimitModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否跳过
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // 检查自定义跳过条件
    if (this.options?.skip) {
      const shouldSkip = await this.options.skip(context);
      if (shouldSkip) return true;
    }

    // 获取配置
    const config = this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    const windowSec = config?.windowSec ?? this.options?.windowSec ?? 60;
    const limit = config?.limit ?? this.options?.limit ?? 100;
    const message = config?.message ?? this.options?.message ?? 'Too Many Requests';
    const statusCode = this.options?.statusCode ?? 429;

    // 生成 key
    const key = this.generateKey(context, config?.key);

    // 执行限流检查
    const info = await this.checkRateLimit(key, windowSec, limit);

    // 设置响应头
    const response = context.switchToHttp().getResponse();
    if (response?.setHeader) {
      response.setHeader('X-RateLimit-Limit', info.limit);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, info.remaining));
      response.setHeader('X-RateLimit-Reset', info.resetTime);
    }

    if (info.blocked) {
      throw new HttpException(
        {
          statusCode,
          message,
          error: 'Too Many Requests',
        },
        statusCode,
      );
    }

    return true;
  }

  private generateKey(context: ExecutionContext, customKey?: string): string {
    const prefix = this.options?.prefix ?? 'ratelimit';

    if (this.options?.keyGenerator) {
      return `${prefix}:${this.options.keyGenerator(context)}`;
    }

    const request = context.switchToHttp().getRequest();
    const ip = request?.ip || request?.connection?.remoteAddress || 'unknown';
    const path = request?.route?.path || request?.url || 'unknown';

    if (customKey) {
      return `${prefix}:${customKey}:${ip}`;
    }

    return `${prefix}:${path}:${ip}`;
  }

  private async checkRateLimit(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<RateLimitInfo> {
    const algorithm = this.options?.algorithm ?? 'sliding-window';

    switch (algorithm) {
      case 'fixed-window':
        return this.fixedWindow(key, windowSec, limit);
      case 'token-bucket':
        return this.tokenBucket(key, windowSec, limit);
      case 'sliding-window':
      default:
        return this.slidingWindow(key, windowSec, limit);
    }
  }

  /**
   * 滑动窗口算法
   */
  private async slidingWindow(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    const multi = this.redis.multi();
    // 移除过期记录
    multi.zremrangebyscore(key, 0, windowStart);
    // 添加当前请求
    multi.zadd(key, now, `${now}-${Math.random()}`);
    // 获取当前窗口请求数
    multi.zcard(key);
    // 设置过期时间
    multi.expire(key, windowSec);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) || 0;

    return {
      remaining: limit - count,
      limit,
      resetTime: Math.ceil((now + windowSec * 1000) / 1000),
      blocked: count > limit,
    };
  }

  /**
   * 固定窗口算法
   */
  private async fixedWindow(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<RateLimitInfo> {
    const windowKey = `${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;

    const multi = this.redis.multi();
    multi.incr(windowKey);
    multi.expire(windowKey, windowSec);

    const results = await multi.exec();
    const count = (results?.[0]?.[1] as number) || 0;

    return {
      remaining: limit - count,
      limit,
      resetTime: Math.ceil(Date.now() / 1000 / windowSec) * windowSec + windowSec,
      blocked: count > limit,
    };
  }

  /**
   * 令牌桶算法
   */
  private async tokenBucket(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const refillRate = limit / windowSec; // 每秒补充的令牌数

    const bucketKey = `${key}:bucket`;
    const lastRefillKey = `${key}:lastRefill`;

    // 获取当前状态
    const [tokensStr, lastRefillStr] = await this.redis.mget(bucketKey, lastRefillKey);
    let tokens = tokensStr ? parseFloat(tokensStr) : limit;
    const lastRefill = lastRefillStr ? parseInt(lastRefillStr, 10) : now;

    // 计算补充的令牌
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(limit, tokens + elapsed * refillRate);

    // 消耗一个令牌
    const blocked = tokens < 1;
    if (!blocked) {
      tokens -= 1;
    }

    // 更新状态
    await this.redis
      .multi()
      .set(bucketKey, tokens.toString())
      .set(lastRefillKey, now.toString())
      .expire(bucketKey, windowSec * 2)
      .expire(lastRefillKey, windowSec * 2)
      .exec();

    return {
      remaining: Math.floor(tokens),
      limit,
      resetTime: Math.ceil(now / 1000) + Math.ceil((limit - tokens) / refillRate),
      blocked,
    };
  }
}
