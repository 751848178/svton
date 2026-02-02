import {
  ObjectStorageClient,
  PutObjectInput,
  PutObjectOutput,
  DeleteObjectInput,
  GetPublicUrlInput,
  PresignInput,
  PresignOutput,
  VerifyCallbackInput,
  VerifyCallbackOutput,
  ObjectStorageProviderError,
  PresignMethod,
} from '@svton/nestjs-object-storage';
import COS from 'cos-nodejs-sdk-v5';
import { CosAdapterOptions } from './cos.interface';

const PROVIDER_NAME = 'tencent-cos';

/**
 * 腾讯云 COS 对象存储客户端
 */
export class CosObjectStorageClient implements ObjectStorageClient {
  private readonly cos: COS;
  private readonly options: CosAdapterOptions;

  constructor(options: CosAdapterOptions) {
    this.options = options;
    this.cos = new COS({
      SecretId: options.secretId,
      SecretKey: options.secretKey,
      UseAccelerate: options.useAccelerate || false,
    });
  }

  /**
   * 上传对象
   */
  async putObject(options: PutObjectInput): Promise<PutObjectOutput> {
    try {
      const result: any = await new Promise((resolve, reject) => {
        this.cos.putObject(
          {
            Bucket: this.options.bucket,
            Region: this.options.region,
            Key: options.key,
            Body: options.body,
            ContentType: options.contentType,
          } as any,
          (err: any, data: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      return {
        key: options.key,
        etag: result.ETag,
      };
    } catch (error) {
      throw new ObjectStorageProviderError(PROVIDER_NAME, error, 'Failed to put object');
    }
  }

  /**
   * 删除对象
   */
  async deleteObject(options: DeleteObjectInput): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.cos.deleteObject(
          {
            Bucket: this.options.bucket,
            Region: this.options.region,
            Key: options.key,
          } as any,
          (err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });
    } catch (error) {
      throw new ObjectStorageProviderError(PROVIDER_NAME, error, 'Failed to delete object');
    }
  }

  /**
   * 获取公开访问 URL
   */
  getPublicUrl(options: GetPublicUrlInput): string {
    if (this.options.publicDomain) {
      return `${this.options.publicDomain}/${options.key}`;
    }

    // 使用默认域名
    return `https://${this.options.bucket}.cos.${this.options.region}.myqcloud.com/${options.key}`;
  }

  /**
   * 生成预签名 URL
   */
  async presign(options: PresignInput): Promise<PresignOutput> {
    try {
      const method = options.method as PresignMethod;
      const expiresIn = options.expiresIn || 3600;

      const url = this.cos.getObjectUrl({
        Bucket: this.options.bucket,
        Region: this.options.region,
        Key: options.key,
        Method: method,
        Expires: expiresIn,
        Sign: true,
      } as any);

      return {
        url,
        method,
        headers: options.contentType ? { 'Content-Type': options.contentType } : undefined,
      };
    } catch (error) {
      throw new ObjectStorageProviderError(PROVIDER_NAME, error, 'Failed to generate presigned URL');
    }
  }

  /**
   * 验证回调签名
   * 腾讯云 COS 暂不支持回调验签，返回未验证状态
   */
  async verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackOutput> {
    return {
      isValid: false,
      provider: 'tencent-cos',
      raw: input,
    };
  }
}

