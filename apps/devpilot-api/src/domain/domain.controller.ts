import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DomainService } from './domain.service';
import { DomainConfigDto } from './dto/domain.dto';

@Controller('domain')
@UseGuards(JwtAuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  // 验证域名格式
  @Get('validate')
  validateDomain(@Query('domain') domain: string) {
    const isValid = this.domainService.validateDomain(domain);
    return { domain, isValid };
  }

  // 生成 Nginx 配置
  @Post('nginx-config')
  generateNginxConfig(@Body() config: DomainConfigDto) {
    const configContent = this.domainService.generateNginxConfig(config);
    return {
      domain: config.domain,
      configContent,
      filename: `${config.domain}.conf`,
    };
  }

  // 生成 Let's Encrypt 脚本
  @Post('certbot-script')
  generateCertbotScript(@Body() body: { domain: string; email: string }) {
    const script = this.domainService.generateCertbotScript(body.domain, body.email);
    return {
      domain: body.domain,
      script,
      filename: `certbot-${body.domain}.sh`,
    };
  }

  // 批量生成配置
  @Post('nginx-config/batch')
  generateMultiDomainConfig(@Body() configs: DomainConfigDto[]) {
    const configContent = this.domainService.generateMultiDomainConfig(configs);
    return { configContent };
  }
}
