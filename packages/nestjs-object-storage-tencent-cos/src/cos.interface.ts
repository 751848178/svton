/**
 * 腾讯云 COS 适配器配置选项
 */
export interface CosAdapterOptions {
  /** SecretId */
  secretId: string;
  /** SecretKey */
  secretKey: string;
  /** 默认 Bucket */
  bucket: string;
  /** 地域（ap-guangzhou/ap-shanghai/ap-beijing 等） */
  region: string;
  /** 公开访问域名（CDN 域名，可选） */
  publicDomain?: string;
  /** 是否使用加速域名 */
  useAccelerate?: boolean;
}
