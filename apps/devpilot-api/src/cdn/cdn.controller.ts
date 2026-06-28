import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ControlAccessPolicyService } from '../control-access-policy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CDNService } from './cdn.service';
import { CDNConfigDto } from './dto/cdn.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('cdn')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class CDNController {
  constructor(
    private readonly cdnService: CDNService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  // 生成 CDN URL 配置
  @Post('url-config')
  async generateUrlConfig(
    @Body() config: CDNConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateCdnArtifact(req, 'cdn.url_config.generate', config.provider);
    return this.cdnService.generateCDNUrlConfig(config);
  }

  // 生成前端 CDN 配置代码
  @Post('frontend-config')
  async generateFrontendConfig(
    @Body() config: CDNConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateCdnArtifact(req, 'cdn.frontend_config.generate', config.provider);
    const code = this.cdnService.generateFrontendConfig(config);
    return {
      filename: 'cdn.config.ts',
      content: code,
    };
  }

  // 生成 CDN 刷新脚本
  @Post('refresh-script')
  async generateRefreshScript(
    @Body() config: CDNConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateCdnArtifact(req, 'cdn.refresh_script.generate', config.provider);
    const script = this.cdnService.generateRefreshScript(config);
    return {
      filename: `cdn-refresh-${config.provider}.sh`,
      content: script,
    };
  }

  // 生成 Next.js CDN 配置
  @Post('nextjs-config')
  async generateNextJSConfig(
    @Body() config: CDNConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateCdnArtifact(req, 'cdn.nextjs_config.generate', config.provider);
    const code = this.cdnService.generateNextJSConfig(config);
    return {
      filename: 'next.config.cdn.js',
      content: code,
    };
  }

  // 生成环境变量配置
  @Post('env-config')
  async generateEnvConfig(
    @Body() config: CDNConfigDto,
    @Request() req: AuthRequest,
  ) {
    await this.assertCanGenerateCdnArtifact(req, 'cdn.env_config.generate', config.provider);
    const content = this.cdnService.generateEnvConfig(config);
    return {
      filename: '.env.cdn',
      content,
    };
  }

  private assertCanGenerateCdnArtifact(
    req: AuthRequest,
    action: string,
    targetId: string | null,
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'cdn_artifact',
      action,
      targetType: 'cdn_artifact',
      targetId,
      risk: 'low',
    });
  }
}
