import { Injectable } from '@nestjs/common';
import { ObjectStorageService } from '@svton/nestjs-object-storage';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  constructor(private readonly storageService: ObjectStorageService) {}

  /**
   * 获取上传凭证（用于客户端直传）
   */
  async getUploadToken(key?: string): Promise<string> {
    return this.storageService.getUploadToken(key);
  }

  /**
   * 上传文件
   */
  async uploadFile(file: Express.Multer.File) {
    // 生成唯一文件名
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const key = `uploads/${filename}`;

    // 上传文件
    const result = await this.storageService.upload(file.buffer, key);

    return {
      key,
      url: result.url,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * 上传图片（带压缩）
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
    const result = await this.storageService.upload(file.buffer, key);

    // 生成缩略图 URL（七牛云图片处理）
    const thumbnailUrl = `${result.url}?imageView2/1/w/200/h/200`;

    return {
      key,
      url: result.url,
      thumbnailUrl,
      size: file.size,
      mimeType: file.mimetype,
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
    await this.storageService.delete(key);
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key: string) {
    const info = await this.storageService.getFileInfo(key);

    // 兼容不同存储提供商的返回格式
    return {
      key,
      size: info.fsize || info.size || 0,
      mimeType: info.mimeType || info.type || 'application/octet-stream',
      hash: info.hash || info.etag || '',
      putTime: info.putTime 
        ? new Date(info.putTime / 10000)  // 七牛云格式
        : info.lastModified 
        ? new Date(info.lastModified)  // 其他格式
        : new Date(),
    };
  }

  /**
   * 获取私有文件访问 URL
   */
  async getPrivateUrl(key: string, expires: number = 3600): Promise<string> {
    return this.storageService.getPrivateUrl(key, expires);
  }

  /**
   * 移动文件
   */
  async moveFile(sourceKey: string, destKey: string): Promise<void> {
    await this.storageService.move(sourceKey, destKey);
  }

  /**
   * 复制文件
   */
  async copyFile(sourceKey: string, destKey: string): Promise<void> {
    await this.storageService.copy(sourceKey, destKey);
  }
}
