import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { TeamModule } from '../team/team.module';
import { CDNConfigService } from './cdn-config.service';
import { CDNConfigController, TeamCredentialController } from './cdn-config.controller';
import { AliyunCdnProvider } from './providers/aliyun-cdn-provider';
import { CdnRefreshProviderFactory } from './providers/cdn-refresh-provider.factory';
import { CloudflareCdnProvider } from './providers/cloudflare-cdn-provider';
import { QiniuCdnProvider } from './providers/qiniu-cdn-provider';
import { TencentCdnProvider } from './providers/tencent-cdn-provider';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule, HttpModule],
  controllers: [CDNConfigController, TeamCredentialController],
  providers: [
    CDNConfigService,
    AliyunCdnProvider,
    TencentCdnProvider,
    QiniuCdnProvider,
    CloudflareCdnProvider,
    CdnRefreshProviderFactory,
  ],
  exports: [CDNConfigService],
})
export class CDNConfigModule {}
