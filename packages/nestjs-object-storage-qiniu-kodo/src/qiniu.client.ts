import * as qiniu from 'qiniu';
import * as crypto from 'crypto';
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
  ObjectStorageSignatureError,
} from '@svton/nestjs-object-storage';
import { QiniuAdapterOptions, QiniuCallbackBody } from './qiniu.interface';

const PROVIDER_NAME = 'qiniu-kodo';

export class QiniuObjectStorageClient implements ObjectStorageClient {
  private readonly mac: qiniu.auth.digest.Mac;
  private readonly config: qiniu.conf.Config;
  private readonly bucketManager: qiniu.rs.BucketManager;
  private readonly options: QiniuAdapterOptions;

  constructor(options: QiniuAdapterOptions) {
    this.options = options;
    this.mac = new qiniu.auth.digest.Mac(options.accessKey, options.secretKey);
    this.config = new qiniu.conf.Config();

    // 设置区域
    if (options.region) {
      const zone = this.getZone(options.region);
      if (zone) {
        this.config.zone = zone;
      }
    }

    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
  }

  private getZone(region: string): qiniu.conf.Zone | undefined {
    const zones: Record<string, qiniu.conf.Zone> = {
      z0: qiniu.zone.Zone_z0,
      z1: qiniu.zone.Zone_z1,
      z2: qiniu.zone.Zone_z2,
      na0: qiniu.zone.Zone_na0,
      as0: qiniu.zone.Zone_as0,
      'cn-east-2': qiniu.zone.Zone_cn_east_2,
    };
    return zones[region];
  }

  async putObject(input: PutObjectInput): Promise<PutObjectOutput> {
    const bucket = input.bucket || this.options.bucket;
    const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${input.key}` });
    const uploadToken = putPolicy.uploadToken(this.mac);

    const formUploader = new qiniu.form_up.FormUploader(this.config);
    const putExtra = new qiniu.form_up.PutExtra();

    if (input.contentType) {
      putExtra.mimeType = input.contentType;
    }

    return new Promise((resolve, reject) => {
      const callback = (err: Error | undefined, body: { key: string; hash: string }, info: { statusCode: number }) => {
        if (err) {
          reject(new ObjectStorageProviderError(PROVIDER_NAME, err));
          return;
        }
        if (info.statusCode !== 200) {
          reject(new ObjectStorageProviderError(PROVIDER_NAME, body, `Upload failed with status ${info.statusCode}`));
          return;
        }
        resolve({
          key: body.key,
          etag: body.hash,
          url: this.getPublicUrl({ bucket, key: body.key }),
        });
      };

      if (Buffer.isBuffer(input.body)) {
        formUploader.put(uploadToken, input.key, input.body, putExtra, callback);
      } else {
        // Stream 上传
        formUploader.putStream(uploadToken, input.key, input.body, putExtra, callback);
      }
    });
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    const bucket = input.bucket || this.options.bucket;

    return new Promise((resolve, reject) => {
      this.bucketManager.delete(bucket, input.key, (err, respBody, respInfo) => {
        if (err) {
          reject(new ObjectStorageProviderError(PROVIDER_NAME, err));
          return;
        }
        if (respInfo.statusCode !== 200) {
          reject(new ObjectStorageProviderError(PROVIDER_NAME, respBody, `Delete failed with status ${respInfo.statusCode}`));
          return;
        }
        resolve();
      });
    });
  }

  getPublicUrl(input: GetPublicUrlInput): string {
    const domain = this.options.publicDomain;
    if (!domain) {
      throw new ObjectStorageProviderError(PROVIDER_NAME, null, 'publicDomain is required for getPublicUrl');
    }
    const baseUrl = domain.endsWith('/') ? domain.slice(0, -1) : domain;
    return `${baseUrl}/${encodeURIComponent(input.key)}`;
  }

  async presign(input: PresignInput): Promise<PresignOutput> {
    const bucket = input.bucket || this.options.bucket;
    const expiresIn = input.expiresIn || 3600;

    if (input.method === 'GET') {
      // 私有空间下载 URL
      const domain = this.options.publicDomain;
      if (!domain) {
        throw new ObjectStorageProviderError(PROVIDER_NAME, null, 'publicDomain is required for presign GET');
      }
      const baseUrl = domain.endsWith('/') ? domain.slice(0, -1) : domain;
      const publicUrl = `${baseUrl}/${encodeURIComponent(input.key)}`;
      const deadline = Math.floor(Date.now() / 1000) + expiresIn;
      
      // 使用 qiniu.util.generateAccessToken 生成私有下载 URL
      const downloadUrl = publicUrl + (publicUrl.includes('?') ? '&' : '?') + `e=${deadline}`;
      const signature = qiniu.util.generateAccessToken(this.mac, downloadUrl, undefined);
      const privateUrl = `${downloadUrl}&token=${signature}`;

      return {
        url: privateUrl,
        method: 'GET',
      };
    }

    // PUT 上传 - 返回上传凭证
    const putPolicyOptions: qiniu.rs.PutPolicyOptions = {
      scope: `${bucket}:${input.key}`,
      expires: expiresIn,
    };

    // 回调配置
    if (input.callback) {
      putPolicyOptions.callbackUrl = input.callback.url;
      putPolicyOptions.callbackBody = input.callback.body || 'key=$(key)&hash=$(etag)&bucket=$(bucket)&fsize=$(fsize)&fname=$(fname)';
      putPolicyOptions.callbackBodyType = input.callback.bodyType || 'application/x-www-form-urlencoded';
    }

    if (input.contentType) {
      putPolicyOptions.mimeLimit = input.contentType;
    }

    const putPolicy = new qiniu.rs.PutPolicy(putPolicyOptions);
    const uploadToken = putPolicy.uploadToken(this.mac);

    // 获取上传域名
    let uploadUrl = this.options.uploadDomain;
    if (!uploadUrl) {
      // 根据区域获取默认上传域名
      const regionUploadUrls: Record<string, string> = {
        z0: 'https://up-z0.qiniup.com',
        z1: 'https://up-z1.qiniup.com',
        z2: 'https://up-z2.qiniup.com',
        na0: 'https://up-na0.qiniup.com',
        as0: 'https://up-as0.qiniup.com',
        'cn-east-2': 'https://up-cn-east-2.qiniup.com',
      };
      uploadUrl = regionUploadUrls[this.options.region || 'z0'] || 'https://up.qiniup.com';
    }

    return {
      url: uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': input.contentType || 'application/octet-stream',
      },
      formFields: {
        token: uploadToken,
        key: input.key,
      },
    };
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackOutput> {
    try {
      // 七牛回调验签
      // Authorization: QBox <AccessKey>:<EncodedSign>
      const authHeader = this.getHeader(input.headers, 'authorization');
      if (!authHeader || !authHeader.startsWith('QBox ')) {
        return this.createInvalidResult('Missing or invalid Authorization header');
      }

      const authParts = authHeader.substring(5).split(':');
      if (authParts.length !== 2) {
        return this.createInvalidResult('Invalid Authorization format');
      }

      const [accessKey, encodedSign] = authParts;
      if (accessKey !== this.options.accessKey) {
        return this.createInvalidResult('AccessKey mismatch');
      }

      // 构造待签名字符串
      const contentType = this.getHeader(input.headers, 'content-type') || '';
      const callbackUrl = `${input.path}${Object.keys(input.query).length > 0 ? '?' + this.buildQueryString(input.query) : ''}`;
      
      let signStr = `${callbackUrl}\n`;
      if (contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('application/json')) {
        signStr += input.rawBody.toString('utf-8');
      }

      // 计算签名
      const hmac = crypto.createHmac('sha1', this.options.secretKey);
      hmac.update(signStr);
      const expectedSign = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_');

      if (encodedSign !== expectedSign) {
        return this.createInvalidResult('Signature mismatch');
      }

      // 解析回调体
      let callbackBody: QiniuCallbackBody = {};
      if (contentType === 'application/json') {
        callbackBody = JSON.parse(input.rawBody.toString('utf-8'));
      } else if (contentType === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams(input.rawBody.toString('utf-8'));
        params.forEach((value, key) => {
          callbackBody[key] = value;
        });
      }

      return {
        isValid: true,
        provider: PROVIDER_NAME,
        bucket: callbackBody.bucket || this.options.bucket,
        key: callbackBody.key,
        etag: callbackBody.hash,
        size: callbackBody.fsize,
        eventType: 'upload',
        metadata: {
          mimeType: callbackBody.mimeType,
          fname: callbackBody.fname,
          endUser: callbackBody.endUser,
        },
        raw: callbackBody,
      };
    } catch (error) {
      throw new ObjectStorageSignatureError(
        error instanceof Error ? error.message : 'Callback verification failed'
      );
    }
  }

  private getHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    if (!key) return undefined;
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }

  private buildQueryString(query: Record<string, string | string[]>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }
    return params.toString();
  }

  private createInvalidResult(reason: string): VerifyCallbackOutput {
    return {
      isValid: false,
      provider: PROVIDER_NAME,
      raw: { reason },
    };
  }
}
