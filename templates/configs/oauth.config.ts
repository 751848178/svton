import { ConfigService } from '@nestjs/config';
import { OAuthModuleOptions } from '@svton/nestjs-oauth';

export const useOAuthConfig = (
  configService: ConfigService,
): OAuthModuleOptions => ({
  wechat: [
    {
      platform: 'open',
      appId: configService.get('WECHAT_OPEN_APP_ID'),
      appSecret: configService.get('WECHAT_OPEN_APP_SECRET'),
      callbackUrl: configService.get('WECHAT_OPEN_CALLBACK_URL'),
    },
    {
      platform: 'miniprogram',
      appId: configService.get('WECHAT_MINI_APP_ID'),
      appSecret: configService.get('WECHAT_MINI_APP_SECRET'),
    },
  ],
});
