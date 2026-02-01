import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CDNService } from './cdn.service';
import { CDNConfigDto } from './dto/cdn.dto';

@Controller('cdn')
@UseGuards(JwtAuthGuard)
export class CDNController {
  constructor(private readonly cdnService: CDNService) {}

  // 生成 CDN URL 配置
  @Post('url-config')
  generateUrlConfig(@Body() config: CDNConfigDto) {
    return this.cdnService.generateCDNUrlConfig(config);
  }

  // 生成前端 CDN 配置代码
  @Post('frontend-config')
  generateFrontendConfig(@Body() config: CDNConfigDto) {
    const code = this.cdnService.generateFrontendConfig(config);
    return {
      filename: 'cdn.config.ts',
      content: code,
    };
  }

  // 生成 CDN 刷新脚本
  @Post('refresh-script')
  generateRefreshScript(@Body() config: CDNConfigDto) {
    const script = this.cdnService.generateRefreshScript(config);
    return {
      filename: `cdn-refresh-${config.provider}.sh`,
      content: script,
    };
  }

  // 生成 Next.js CDN 配置
  @Post('nextjs-config')
  generateNextJSConfig(@Body() config: CDNConfigDto) {
    const code = this.cdnService.generateNextJSConfig(config);
    return {
      filename: 'next.config.cdn.js',
      content: code,
    };
  }

  // 生成环境变量配置
  @Post('env-config')
  generateEnvConfig(@Body() config: CDNConfigDto) {
    const content = this.cdnService.generateEnvConfig(config);
    return {
      filename: '.env.cdn',
      content,
    };
  }
}
