import { ConfigService } from '@nestjs/config';
import { ObjectStorageModuleOptions } from '@svton/nestjs-object-storage';
import { createQiniuAdapter } from '@svton/nestjs-object-storage-qiniu-kodo';

export const useStorageConfig = (
  configService: ConfigService,
): ObjectStorageModuleOptions => ({
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
});
