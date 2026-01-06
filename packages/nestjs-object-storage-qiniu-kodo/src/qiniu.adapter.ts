import { ObjectStorageAdapter, ObjectStorageClient } from '@svton/nestjs-object-storage';
import { QiniuAdapterOptions } from './qiniu.interface';
import { QiniuObjectStorageClient } from './qiniu.client';

/**
 * 七牛云对象存储适配器
 */
export class QiniuObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = 'qiniu-kodo';
  private readonly options: QiniuAdapterOptions;

  constructor(options: QiniuAdapterOptions) {
    this.options = options;
  }

  createClient(): ObjectStorageClient {
    return new QiniuObjectStorageClient(this.options);
  }
}

/**
 * 创建七牛云适配器
 */
export function createQiniuAdapter(options: QiniuAdapterOptions): ObjectStorageAdapter {
  return new QiniuObjectStorageAdapter(options);
}
