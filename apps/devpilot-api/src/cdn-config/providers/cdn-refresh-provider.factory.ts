import { Injectable, NotFoundException } from '@nestjs/common';
import { CDNProvider } from '../../cdn/dto/cdn.dto';
import { AliyunCdnProvider } from './aliyun-cdn-provider';
import { CloudflareCdnProvider } from './cloudflare-cdn-provider';
import { CdnRefreshProvider } from './cdn-refresh-provider';
import { QiniuCdnProvider } from './qiniu-cdn-provider';
import { TencentCdnProvider } from './tencent-cdn-provider';

/**
 * CDN 刷新 provider 工厂。
 *
 * 按厂商枚举返回对应的 SDK 实现。
 */
@Injectable()
export class CdnRefreshProviderFactory {
  constructor(
    private readonly aliyun: AliyunCdnProvider,
    private readonly tencent: TencentCdnProvider,
    private readonly qiniu: QiniuCdnProvider,
    private readonly cloudflare: CloudflareCdnProvider,
  ) {}

  resolve(provider: CDNProvider | string): CdnRefreshProvider {
    switch (provider) {
      case CDNProvider.ALIYUN:
      case 'aliyun':
        return this.aliyun;
      case CDNProvider.TENCENT:
      case 'tencent':
        return this.tencent;
      case CDNProvider.QINIU:
      case 'qiniu':
        return this.qiniu;
      case CDNProvider.CLOUDFLARE:
      case 'cloudflare':
        return this.cloudflare;
      default:
        throw new NotFoundException(`Unsupported CDN provider: ${provider}`);
    }
  }
}
