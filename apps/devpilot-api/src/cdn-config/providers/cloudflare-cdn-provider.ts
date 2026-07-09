import { Injectable, Logger } from '@nestjs/common';
import { Cloudflare } from 'cloudflare';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * Cloudflare CDN 刷新（基于官方 SDK `cloudflare`）。
 *
 * SDK 提供 bearer token 鉴权、重试、结构化错误（RateLimitError 等），
 * 取代原本手搓的 fetch + 手动 header 拼装。
 *
 * 凭据结构：`{ apiToken, zoneId }`。
 * 按 URL 精确刷新；不传 urls 时整站刷新（purge_everything）。
 */
type CloudflareClientLike = {
  cache: {
    purge(params: {
      zone_id: string;
      files?: string[];
      purge_everything?: boolean;
    }): Promise<{ id?: string }>;
  };
};

@Injectable()
export class CloudflareCdnProvider implements CdnRefreshProvider {
  readonly provider = 'cloudflare';
  private readonly logger = new Logger(CloudflareCdnProvider.name);

  async purge(credentials: CdnRefreshCredentials, urls: string[], _isDirectory: boolean) {
    const { apiToken, zoneId } = this.extractCreds(credentials.raw);

    const client = new Cloudflare({ apiToken }) as unknown as CloudflareClientLike;
    const purgeParams =
      urls.length > 0
        ? { zone_id: zoneId, files: urls }
        : { zone_id: zoneId, purge_everything: true };

    const result = await client.cache.purge(purgeParams);
    const requestId = result?.id ? String(result.id) : undefined;
    this.logger.log(`Cloudflare purge submitted: zone=${zoneId}, urls=${urls.length}`);
    return { requestId };
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
