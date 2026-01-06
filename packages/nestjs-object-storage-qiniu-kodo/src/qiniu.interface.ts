/**
 * 七牛云适配器配置选项
 */
export interface QiniuAdapterOptions {
  /** Access Key */
  accessKey: string;
  /** Secret Key */
  secretKey: string;
  /** 默认 Bucket */
  bucket: string;
  /** 区域（z0/z1/z2/na0/as0/cn-east-2） */
  region?: string;
  /** 公开访问域名（CDN 域名） */
  publicDomain?: string;
  /** 上传域名（可选，默认使用区域配置） */
  uploadDomain?: string;
  /** 回调验签使用的公钥（可选，用于验证回调） */
  callbackPublicKey?: string;
}

/**
 * 七牛回调请求体结构
 */
export interface QiniuCallbackBody {
  key?: string;
  hash?: string;
  bucket?: string;
  fsize?: number;
  fname?: string;
  mimeType?: string;
  endUser?: string;
  [key: string]: unknown;
}
