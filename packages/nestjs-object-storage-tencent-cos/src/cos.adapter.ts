import { ObjectStorageAdapter, ObjectStorageClient } from '@svton/nestjs-object-storage';
import { CosAdapterOptions } from './cos.interface';
import { CosObjectStorageClient } from './cos.client';

/**
 * 腾讯云 COS 对象存储适配器
 */
export class CosObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = 'tencent-cos';
  private readonly options: CosAdapterOptions;

  constructor(options: CosAdapterOptions) {
    this.options = options;
  }

  createClient(): ObjectStorageClient {
    return new CosObjectStorageClient(this.options);
  }
}

/**
 * 创建腾讯云 COS 适配器
 */
export function createCosAdapter(options: CosAdapterOptions): ObjectStorageAdapter {
  return new CosObjectStorageAdapter(options);
}
