import { Injectable, Logger } from '@nestjs/common';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * 腾讯云 CDN 刷新（基于官方 SDK `tencentcloud-sdk-nodejs-cdn`）。
 *
 * SDK 内部完成 TC3-HMAC-SHA256 签名，不再手搓（历史实现曾在 header 里留空 Signature
 * 并把 secretKey 明文放进 X-TC-Secret-Key —— 安全 + 功能双重缺陷）。
 *
 * 凭据结构：`{ secretId, secretKey }`。
 */
// SDK 的 TS 类型随版本不全，且作为 devdep 时类型声明可能缺失，统一走 any。
type TencentCdnClient = {
  PurgeUrlsCache(req: { Urls: string[] }): Promise<{ RequestId?: string }>;
  PurgePathCache(req: { Paths: string[] }): Promise<{ RequestId?: string }>;
};

type TencentCdnClientCtor = new (config: {
  credential: { secretId: string; secretKey: string };
  region: string;
  profile?: { httpProfile?: { endpoint?: string } };
}) => TencentCdnClient;

// 动态加载避免 SDK 类型缺失导致编译失败；保留可测试性（测试 mock 此模块）。
function loadTencentCdnClient(): TencentCdnClientCtor {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sdk = require('tencentcloud-sdk-nodejs-cdn');
  return sdk.cdn.v20180606.Client as TencentCdnClientCtor;
}

@Injectable()
export class TencentCdnProvider implements CdnRefreshProvider {
  readonly provider = 'tencent';
  private readonly logger = new Logger(TencentCdnProvider.name);

  async purge(credentials: CdnRefreshCredentials, urls: string[], isDirectory: boolean) {
    const { secretId, secretKey } = this.extractCreds(credentials.raw);

    const Client = loadTencentCdnClient();
    const client = new Client({
      credential: { secretId, secretKey },
      region: 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'cdn.tencentcloudapi.com' } },
    });

    const response = isDirectory
      ? await client.PurgePathCache({ Paths: urls })
      : await client.PurgeUrlsCache({ Urls: urls });

    const requestId = response?.RequestId ? String(response.RequestId) : undefined;
    this.logger.log(
      `Tencent CDN purge submitted: ${isDirectory ? 'PurgePathCache' : 'PurgeUrlsCache'}, urls=${urls.length}`,
    );
    return { requestId };
  }

  private extractCreds(raw: Record<string, unknown>) {
    const secretId = String(raw.secretId ?? raw.SecretId ?? '');
    const secretKey = String(raw.secretKey ?? raw.SecretKey ?? '');
    if (!secretId || !secretKey) {
      throw new Error('Tencent CDN credentials missing secretId/secretKey');
    }
    return { secretId, secretKey };
  }
}
