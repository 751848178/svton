import { Injectable, Inject } from '@nestjs/common';
import { ObjectStorageClient, InjectObjectStorage } from '@svton/nestjs-object-storage';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  constructor(
    @InjectObjectStorage()
    private readonly storageClient: ObjectStorageClient,
  ) {}

  /**
   * 上传文件
   */
  async uploadFile(file: Express.Multer.File) {
    // 生成唯一文件名
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const key = `uploads/${filename}`;

    // 上传文件
    const result = await this.storageClient.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // 获取公开访问 URL
    const url = this.storageClient.getPublicUrl({ key });

    return {
      key: result.key,
      url,
      size: file.size,
      mimeType: file.mimetype,
      etag: result.etag,
    };
  }

  /**
   * 上传图片
   */
  async uploadImage(file: Express.Multer.File) {
    // 验证是否为图片
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const key = `images/${filename}`;

    // 上传原图
    const result = await this.storageClient.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // 获取公开访问 URL
    const url = this.storageClient.getPublicUrl({ key });

    // 生成缩略图 URL（七牛云图片处理）
    const thumbnailUrl = `${url}?imageView2/1/w/200/h/200`;

    return {
      key: result.key,
      url,
      thumbnailUrl,
      size: file.size,
      mimeType: file.mimetype,
      etag: result.etag,
    };
  }

  /**
   * 批量上传
   */
  async uploadBatch(files: Express.Multer.File[]) {
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file)),
    );

    return results;
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<void> {
    await this.storageClient.deleteObject({ key });
  }

  /**
   * 获取预签名上传 URL（用于客户端直传）
   */
  async getPresignedUploadUrl(key: string, contentType?: string) {
    const result = await this.storageClient.presign({
      key,
      method: 'PUT',
      expiresIn: 3600, // 1 小时
      contentType,
    });

    return {
      url: result.url,
      method: result.method,
      headers: result.headers,
      expiresIn: 3600,
    };
  }

  /**
   * 获取预签名下载 URL（用于私有文件访问）
   */
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600) {
    const result = await this.storageClient.presign({
      key,
      method: 'GET',
      expiresIn,
    });

    return {
      url: result.url,
      expiresIn,
    };
  }
}
