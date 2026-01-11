import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { WECHAT_ENDPOINTS } from '../constants';
import type {
  WechatProviderConfig,
  WechatAccessTokenResponse,
  WechatUserInfo,
  WechatMiniProgramSession,
  WechatPhoneInfo,
  WechatErrorResponse,
  OAuthResult,
} from '../interfaces';

@Injectable()
export class WechatProvider {
  private readonly logger = new Logger(WechatProvider.name);
  private readonly http: AxiosInstance;
  private configs: Map<string, WechatProviderConfig> = new Map();

  constructor() {
    this.http = axios.create({ timeout: 10000 });
  }

  /**
   * 注册微信配置
   */
  registerConfig(config: WechatProviderConfig | WechatProviderConfig[]): void {
    const configs = Array.isArray(config) ? config : [config];
    for (const c of configs) {
      const key = `${c.platform}:${c.appId}`;
      this.configs.set(key, c);
    }
  }

  /**
   * 获取配置
   */
  getConfig(platform: string, appId?: string): WechatProviderConfig | undefined {
    if (appId) {
      return this.configs.get(`${platform}:${appId}`);
    }
    // 返回该平台的第一个配置
    for (const [key, config] of this.configs) {
      if (key.startsWith(`${platform}:`)) {
        return config;
      }
    }
    return undefined;
  }

  /**
   * 生成授权 URL (开放平台/公众号)
   */
  getAuthorizationUrl(
    platform: 'open' | 'mp',
    state: string,
    appId?: string,
  ): string {
    const config = this.getConfig(platform, appId);
    if (!config) {
      throw new Error(`Wechat ${platform} config not found`);
    }

    const endpoints = platform === 'open' ? WECHAT_ENDPOINTS.OPEN : WECHAT_ENDPOINTS.MP;
    const scope = config.scope || (platform === 'open' ? 'snsapi_login' : 'snsapi_userinfo');

    const params = new URLSearchParams({
      appid: config.appId,
      redirect_uri: config.callbackUrl || '',
      response_type: 'code',
      scope,
      state,
    });

    return `${endpoints.AUTHORIZE}?${params.toString()}#wechat_redirect`;
  }

  /**
   * 通过 code 获取 access_token (开放平台/公众号)
   */
  async getAccessToken(
    platform: 'open' | 'mp',
    code: string,
    appId?: string,
  ): Promise<OAuthResult<WechatAccessTokenResponse>> {
    const config = this.getConfig(platform, appId);
    if (!config) {
      return { success: false, error: { code: -1, message: `Wechat ${platform} config not found` } };
    }

    const endpoints = platform === 'open' ? WECHAT_ENDPOINTS.OPEN : WECHAT_ENDPOINTS.MP;

    try {
      const { data } = await this.http.get<WechatAccessTokenResponse & WechatErrorResponse>(
        endpoints.ACCESS_TOKEN,
        {
          params: {
            appid: config.appId,
            secret: config.appSecret,
            code,
            grant_type: 'authorization_code',
          },
        },
      );

      if (data.errcode) {
        this.logger.error(`Wechat getAccessToken error: ${data.errcode} - ${data.errmsg}`);
        return { success: false, error: { code: data.errcode, message: data.errmsg } };
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error('Wechat getAccessToken request failed', error);
      return { success: false, error: { code: -1, message: 'Request failed' } };
    }
  }

  /**
   * 刷新 access_token
   */
  async refreshAccessToken(
    platform: 'open' | 'mp',
    refreshToken: string,
    appId?: string,
  ): Promise<OAuthResult<WechatAccessTokenResponse>> {
    const config = this.getConfig(platform, appId);
    if (!config) {
      return { success: false, error: { code: -1, message: `Wechat ${platform} config not found` } };
    }

    const endpoints = platform === 'open' ? WECHAT_ENDPOINTS.OPEN : WECHAT_ENDPOINTS.MP;

    try {
      const { data } = await this.http.get<WechatAccessTokenResponse & WechatErrorResponse>(
        endpoints.REFRESH_TOKEN,
        {
          params: {
            appid: config.appId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          },
        },
      );

      if (data.errcode) {
        return { success: false, error: { code: data.errcode, message: data.errmsg } };
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error('Wechat refreshAccessToken request failed', error);
      return { success: false, error: { code: -1, message: 'Request failed' } };
    }
  }

  /**
   * 获取用户信息 (开放平台/公众号)
   */
  async getUserInfo(
    accessToken: string,
    openid: string,
  ): Promise<OAuthResult<WechatUserInfo>> {
    try {
      const { data } = await this.http.get<WechatUserInfo & WechatErrorResponse>(
        WECHAT_ENDPOINTS.OPEN.USERINFO,
        {
          params: {
            access_token: accessToken,
            openid,
            lang: 'zh_CN',
          },
        },
      );

      if ((data as WechatErrorResponse).errcode) {
        const err = data as WechatErrorResponse;
        return { success: false, error: { code: err.errcode, message: err.errmsg } };
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error('Wechat getUserInfo request failed', error);
      return { success: false, error: { code: -1, message: 'Request failed' } };
    }
  }

  /**
   * 小程序 code2session
   */
  async code2Session(
    code: string,
    appId?: string,
  ): Promise<OAuthResult<WechatMiniProgramSession>> {
    const config = this.getConfig('miniprogram', appId);
    if (!config) {
      return { success: false, error: { code: -1, message: 'Wechat miniprogram config not found' } };
    }

    try {
      const { data } = await this.http.get<WechatMiniProgramSession & WechatErrorResponse>(
        WECHAT_ENDPOINTS.MINIPROGRAM.CODE2SESSION,
        {
          params: {
            appid: config.appId,
            secret: config.appSecret,
            js_code: code,
            grant_type: 'authorization_code',
          },
        },
      );

      if (data.errcode) {
        this.logger.error(`Wechat code2Session error: ${data.errcode} - ${data.errmsg}`);
        return { success: false, error: { code: data.errcode, message: data.errmsg } };
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error('Wechat code2Session request failed', error);
      return { success: false, error: { code: -1, message: 'Request failed' } };
    }
  }

  /**
   * 小程序获取手机号
   */
  async getPhoneNumber(
    code: string,
    accessToken: string,
  ): Promise<OAuthResult<WechatPhoneInfo>> {
    try {
      const { data } = await this.http.post<{ errcode: number; errmsg: string; phone_info?: WechatPhoneInfo }>(
        `${WECHAT_ENDPOINTS.MINIPROGRAM.GET_PHONE}?access_token=${accessToken}`,
        { code },
      );

      if (data.errcode !== 0) {
        return { success: false, error: { code: data.errcode, message: data.errmsg } };
      }

      return { success: true, data: data.phone_info };
    } catch (error) {
      this.logger.error('Wechat getPhoneNumber request failed', error);
      return { success: false, error: { code: -1, message: 'Request failed' } };
    }
  }
}
