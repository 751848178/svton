import { ConfigService } from '@nestjs/config';
import { ObjectStorageModuleOptions } from '@svton/nestjs-object-storage';

export const useStorageConfig = (
  configService: ConfigService,
): ObjectStorageModuleOptions => ({
  provider: configService.get('STORAGE_PROVIDER', 'qiniu'),
  qiniu: {
    accessKey: configService.get('QINIU_ACCESS_KEY'),
    secretKey: configService.get('QINIU_SECRET_KEY'),
    bucket: configService.get('QINIU_BUCKET'),
    domain: configService.get('QINIU_DOMAIN'),
  },
});
