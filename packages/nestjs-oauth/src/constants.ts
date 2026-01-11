export const OAUTH_OPTIONS = 'OAUTH_OPTIONS';
export const WECHAT_PROVIDER = 'WECHAT_PROVIDER';

// 微信 API 端点
export const WECHAT_ENDPOINTS = {
  // 开放平台 (网站应用)
  OPEN: {
    AUTHORIZE: 'https://open.weixin.qq.com/connect/qrconnect',
    ACCESS_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    REFRESH_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/refresh_token',
    USERINFO: 'https://api.weixin.qq.com/sns/userinfo',
  },
  // 公众号 (网页授权)
  MP: {
    AUTHORIZE: 'https://open.weixin.qq.com/connect/oauth2/authorize',
    ACCESS_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    REFRESH_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/refresh_token',
    USERINFO: 'https://api.weixin.qq.com/sns/userinfo',
  },
  // 小程序
  MINIPROGRAM: {
    CODE2SESSION: 'https://api.weixin.qq.com/sns/jscode2session',
    GET_PHONE: 'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
  },
} as const;
