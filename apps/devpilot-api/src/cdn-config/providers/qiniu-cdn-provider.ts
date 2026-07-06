import { Injectable, Logger } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { CdnRefreshProvider, CdnRefreshCredentials } from './cdn-refresh-provider';

/**
 * 七牛 CDN 刷新（基于 `qiniu` 官方 SDK 的 `cdn.CdnManager`）。
 *
 * 凭据结构：`{ accessKey, secretKey }`。
 */
@Injectable()
export class QiniuCdnProvider implements CdnRefreshProvider {
  readonly provider = 'qiniu';
  private readonly logger = new Logger(QiniuCdnProvider.name);

  async purge(credentials: CdnRefreshCredentials, urls: string[], isDirectory: boolean) {
    const { accessKey, secretKey } = this.extractCreds(credentials.raw);
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    const manager = new qiniu.cdn.CdnManager(mac);

    if (isDirectory) {
      // refreshDirs(dirs, callback) — 包装为 Promise
      await new Promise<void>((resolve, reject) => {
        manager.refreshDirs(urls, (err, body) => {
          if (err) reject(err);
          else resolve(body as unknown as void);
        });
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        manager.refreshUrls(urls, (err, body) => {
          if (err) reject(err);
          else resolve(body as unknown as void);
        });
      });
    }
    this.logger.log(`Qiniu CDN purge submitted: urls=${urls.length}, isDirectory=${isDirectory}`);
    return { requestId: undefined };
  }

  private extractCreds(raw: Record<string, unknown>) {
    const accessKey = String(raw.accessKey ?? raw.ACCESS_KEY ?? '');
    const secretKey = String(raw.secretKey ?? raw.SECRET_KEY ?? '');
    if (!accessKey || !secretKey) {
      throw new Error('Qiniu CDN credentials missing accessKey/secretKey');
    }
    return { accessKey, secretKey };
  }
}
