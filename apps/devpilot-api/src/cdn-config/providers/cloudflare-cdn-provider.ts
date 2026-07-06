import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * Cloudflare CDN 刷新。
 *
 * 通过 Cloudflare REST API（`/zones/{zoneId}/purge_cache`）调用。
 * 凭据结构：`{ apiToken, zoneId }`。
 * 按 URL 精确刷新；不传 urls 时整站刷新（purge_everything）。
 */
@Injectable()
export class CloudflareCdnProvider implements CdnRefreshProvider {
  readonly provider = 'cloudflare';
  private readonly logger = new Logger(CloudflareCdnProvider.name);
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(private readonly httpService: HttpService) {}

  async purge(credentials: CdnRefreshCredentials, urls: string[], _isDirectory: boolean) {
    const { apiToken, zoneId } = this.extractCreds(credentials.raw);
    const body = urls.length > 0 ? { files: urls } : { purge_everything: true };
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/zones/${zoneId}/purge_cache`, body, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }),
    );
    this.logger.log(`Cloudflare purge submitted: zone=${zoneId}, urls=${urls.length}`);
    return { requestId: data?.result?.id ? String(data.result.id) : undefined };
  }

  private extractCreds(raw: Record<string, unknown>) {
    const apiToken = String(raw.apiToken ?? raw.API_TOKEN ?? '');
    const zoneId = String(raw.zoneId ?? raw.ZONE_ID ?? '');
    if (!apiToken || !zoneId) {
      throw new Error('Cloudflare credentials missing apiToken/zoneId');
    }
    return { apiToken, zoneId };
  }
}
