import { Config as AliyunConfig } from '@alicloud/openapi-client';
import Cdn20180510, {
  RefreshObjectCachesRequest,
} from '@alicloud/cdn20180510';
import { Injectable, Logger } from '@nestjs/common';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * 阿里云 CDN 刷新（基于 `@alicloud/cdn20180510` 官方 SDK）。
 *
 * 凭据结构：`{ accessKeyId, accessKeySecret }`。
 */
@Injectable()
export class AliyunCdnProvider implements CdnRefreshProvider {
  readonly provider = 'aliyun';
  private readonly logger = new Logger(AliyunCdnProvider.name);

  async purge(credentials: CdnRefreshCredentials, urls: string[], isDirectory: boolean) {
    const { accessKeyId, accessKeySecret } = this.extractCreds(credentials.raw);
    const config = new AliyunConfig({
      accessKeyId,
      accessKeySecret,
      endpoint: 'cdn.aliyuncs.com',
    });
    const client = new Cdn20180510(config);
    const request = new RefreshObjectCachesRequest({
      objectPath: urls.join('\n'),
      objectType: isDirectory ? 'Directory' : 'File',
    });
    const response = await client.refreshObjectCaches(request);
    const taskId = response?.body?.taskId;
    this.logger.log(`Aliyun CDN purge submitted: taskId=${taskId}, urls=${urls.length}`);
    return { requestId: taskId ? String(taskId) : undefined };
  }

  private extractCreds(raw: Record<string, unknown>) {
    const accessKeyId = String(raw.accessKeyId ?? raw.AccessKeyId ?? '');
    const accessKeySecret = String(raw.accessKeySecret ?? raw.AccessKeySecret ?? '');
    if (!accessKeyId || !accessKeySecret) {
      throw new Error('Aliyun CDN credentials missing accessKeyId/accessKeySecret');
    }
    return { accessKeyId, accessKeySecret };
  }
}
