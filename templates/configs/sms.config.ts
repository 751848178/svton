import { ConfigService } from '@nestjs/config';
import { SmsModuleOptions } from '@svton/nestjs-sms';

export const useSmsConfig = (
  configService: ConfigService,
): SmsModuleOptions => ({
  provider: configService.get('SMS_PROVIDER', 'aliyun'),
  accessKeyId: configService.get('SMS_ACCESS_KEY_ID'),
  accessKeySecret: configService.get('SMS_ACCESS_KEY_SECRET'),
  signName: configService.get('SMS_SIGN_NAME'),
});
