import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '@svton/nestjs-rate-limit';

@Controller('examples/api')
@UseGuards(RateLimitGuard)
export class ApiController {
  /**
   * 普通接口 - 每分钟 10 次
   */
  @Get('normal')
  @RateLimit({ ttl: 60, limit: 10 })
  normal() {
    return {
      message: 'Normal API',
      timestamp: Date.now(),
    };
  }

  /**
   * 严格限流 - 每分钟 3 次
   */
  @Get('strict')
  @RateLimit({ ttl: 60, limit: 3 })
  strict() {
    return {
      message: 'Strict rate limit API',
      timestamp: Date.now(),
    };
  }

  /**
   * 宽松限流 - 每分钟 100 次
   */
  @Get('loose')
  @RateLimit({ ttl: 60, limit: 100 })
  loose() {
    return {
      message: 'Loose rate limit API',
      timestamp: Date.now(),
    };
  }

  /**
   * 短时限流 - 每 10 秒 5 次
   */
  @Get('short-window')
  @RateLimit({ ttl: 10, limit: 5 })
  shortWindow() {
    return {
      message: 'Short window rate limit API',
      timestamp: Date.now(),
    };
  }

  /**
   * 长时限流 - 每小时 1000 次
   */
  @Get('long-window')
  @RateLimit({ ttl: 3600, limit: 1000 })
  longWindow() {
    return {
      message: 'Long window rate limit API',
      timestamp: Date.now(),
    };
  }

  /**
   * 登录接口 - 每分钟 5 次（防暴力破解）
   */
  @Post('login')
  @RateLimit({ ttl: 60, limit: 5 })
  login() {
    return {
      message: 'Login API',
      token: 'mock_token',
    };
  }

  /**
   * 发送验证码 - 每分钟 1 次
   */
  @Post('send-code')
  @RateLimit({ ttl: 60, limit: 1 })
  sendCode() {
    return {
      message: 'Verification code sent',
      code: '123456', // 开发环境返回
    };
  }

  /**
   * 搜索接口 - 每秒 10 次
   */
  @Get('search')
  @RateLimit({ ttl: 1, limit: 10 })
  search() {
    return {
      message: 'Search API',
      results: [],
    };
  }

  /**
   * 无限流接口（用于测试）
   */
  @Get('unlimited')
  unlimited() {
    return {
      message: 'Unlimited API',
      timestamp: Date.now(),
    };
  }
}
