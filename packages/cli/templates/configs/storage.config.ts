import { ConfigService } from '@nestjs/config';
import { ObjectStorageModuleOptions } from '@svton/nestjs-object-storage';
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';
import { createCosAdapter } from '@svton/nestjs-object-storage-tencent-cos';

export const useStorageConfig = (
  configService: ConfigService,
): ObjectStorageModuleOptions => {
  const provider = configService.get('STORAGE_PROVIDER', 'qiniu');

  if (provider === 'tencent-cos') {
    return {
      defaultBucket: configService.get('COS_BUCKET') || '',
      publicBaseUrl: configService.get('COS_DOMAIN') || '',
      defaultExpiresInSeconds: 3600,
      adapter: createCosAdapter({
        secretId: configService.get('COS_SECRET_ID') || '',
        secretKey: configService.get('COS_SECRET_KEY') || '',
        bucket: configService.get('COS_BUCKET') || '',
        region: configService.get('COS_REGION') || 'ap-guangzhou',
        publicDomain: configService.get('COS_DOMAIN'),
        useAccelerate: configService.get('COS_USE_ACCELERATE') === 'true',
      }),
    };
  }

  // 默认使用七牛云
  return {
    defaultBucket: configService.get('QINIU_BUCKET') || '',
    publicBaseUrl: configService.get('QINIU_DOMAIN') || '',
    defaultExpiresInSeconds: 3600,
    adapter: createQiniuAdapter({
      accessKey: configService.get('QINIU_ACCESS_KEY') || '',
      secretKey: configService.get('QINIU_SECRET_KEY') || '',
      bucket: configService.get('QINIU_BUCKET') || '',
      region: configService.get('QINIU_REGION', 'z0') as any,
      publicDomain: configService.get('QINIU_DOMAIN') || '',
    }),
  };
};
