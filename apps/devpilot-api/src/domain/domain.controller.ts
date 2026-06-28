import { Controller, Post, Body, UseGuards, Get, Query, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ControlAccessPolicyService } from '../control-access-policy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DomainService } from './domain.service';
import { DomainConfigDto } from './dto/domain.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('domain')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class DomainController {
  constructor(
    private readonly domainService: DomainService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  // 验证域名格式
  @Get('validate')
  async validateDomain(
    @Query('domain') domain: string,
    @Request() req: AuthRequest,
  ) {
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'domain_config',
      action: 'domain.validate',
      targetType: 'domain',
      targetId: domain || null,
      risk: 'low',
    });

    const isValid = this.domainService.validateDomain(domain);
    return { domain, isValid };
  }

  // 生成 Nginx 配置
  @Post('nginx-config')
  async generateNginxConfig(
    @Body() config: DomainConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateDomainArtifact(req, 'domain.nginx_config.generate', config.domain);
    const configContent = this.domainService.generateNginxConfig(config);
    return {
      domain: config.domain,
      configContent,
      filename: `${config.domain}.conf`,
    };
  }

  // 生成 Let's Encrypt 脚本
  @Post('certbot-script')
  async generateCertbotScript(
    @Body() body: { domain: string; email: string },
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateDomainArtifact(req, 'domain.certbot_script.generate', body.domain);
    const script = this.domainService.generateCertbotScript(body.domain, body.email);
    return {
      domain: body.domain,
      script,
      filename: `certbot-${body.domain}.sh`,
    };
  }

  // 批量生成配置
  @Post('nginx-config/batch')
  async generateMultiDomainConfig(
    @Body() configs: DomainConfigDto[],
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateDomainArtifact(req, 'domain.nginx_config.batch_generate', null);
    const configContent = this.domainService.generateMultiDomainConfig(configs);
    return { configContent };
  }

  private assertCanGenerateDomainArtifact(
    req: AuthRequest,
    action: string,
    targetId: string | null,
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'domain_config',
      action,
      targetType: 'domain_config_artifact',
      targetId,
      risk: 'low',
    });
  }
}
