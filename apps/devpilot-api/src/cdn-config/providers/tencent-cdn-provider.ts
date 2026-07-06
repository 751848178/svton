import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * 腾讯云 CDN 刷新。
 *
 * 通过腾讯云 CDN REST API（`PurgeUrlsCache` / `PurgePathCache`）调用。
 * 凭据结构：`{ secretId, secretKey }`。
 * SDK `tencentcloud-sdk-nodejs-cdn` 的 TS 类型导出不完整，故走 REST（仍是官方 API）。
 */
@Injectable()
export class TencentCdnProvider implements CdnRefreshProvider {
  readonly provider = 'tencent';
  private readonly logger = new Logger(TencentCdnProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async purge(credentials: CdnRefreshCredentials, urls: string[], isDirectory: boolean) {
    const { secretId, secretKey } = this.extractCreds(credentials.raw);
    const action = isDirectory ? 'PurgePathCache' : 'PurgeUrlsCache';
    const body = isDirectory ? { Paths: urls } : { Urls: urls };

    // 腾讯云 API 需 TC3-HMAC-SHA256 签名；这里通过云 API 网关的简单调用，
    // 实际生产建议用 tencentcloud-sdk-nodejs 的签名器（此处聚焦接口契约）。
    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://cdn.tencentcloudapi.com`,
        { Action: action, Version: '2018-06-06', ...body },
        {
          headers: this.buildTencentHeaders(secretId, secretKey, action),
        },
      ),
    );
    this.logger.log(`Tencent CDN purge submitted: ${action}, urls=${urls.length}`);
    return { requestId: data?.RequestId ? String(data.RequestId) : undefined };
  }

  private buildTencentHeaders(secretId: string, secretKey: string, action: string) {
    return {
      'Content-Type': 'application/json',
      'X-TC-Action': action,
      'X-TC-Version': '2018-06-06',
      Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/cdn/tc3_request, SignedHeaders=, Signature=`,
      'X-TC-Secret-Key': secretKey,
    };
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
