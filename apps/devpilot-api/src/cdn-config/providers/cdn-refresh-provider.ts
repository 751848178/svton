/**
 * CDN 刷新 provider 端口（抽象）。
 *
 * 取代 `cdn-config.service.purgeCache` 的模拟实现（`// 实际实现需要调用 CDN 提供商 API`），
 * 每家厂商一个实现，调用其官方 SDK 真实刷新缓存。
 */
export type CdnRefreshCredentials = {
  /** 厂商凭据（解密后的原始 JSON，结构因厂商而异）。 */
  raw: Record<string, unknown>;
};

export interface CdnRefreshProvider {
  /** 厂商标识（与 CDNProvider enum 对齐）。 */
  readonly provider: string;

  /**
   * 提交缓存刷新。
   * @param credentials 解密后的凭据
   * @param urls 待刷新的 URL 或路径列表
   * @param isDirectory 是否按目录刷新（false=按 URL）
   * @returns 厂商返回的刷新任务 ID（若厂商支持）
   */
  purge(
    credentials: CdnRefreshCredentials,
    urls: string[],
    isDirectory: boolean,
  ): Promise<{ requestId?: string }>;
}
