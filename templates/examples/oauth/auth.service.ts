import { Injectable } from '@nestjs/common';
import { OAuthService } from '@svton/nestjs-oauth';

@Injectable()
export class AuthService {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * 获取微信开放平台授权 URL（PC 扫码登录）
   */
  getWechatOpenAuthUrl(state: string): string {
    return this.oauthService.wechat.getAuthorizationUrl('open', state);
  }

  /**
   * 获取微信公众号授权 URL（网页授权）
   */
  getWechatMpAuthUrl(state: string): string {
    return this.oauthService.wechat.getAuthorizationUrl('mp', state);
  }

  /**
   * 处理微信开放平台回调
   */
  async handleWechatOpenCallback(code: string) {
    // 获取 access_token
    const tokenResult = await this.oauthService.wechat.getAccessToken('open', code);
    
    if (!tokenResult.success || !tokenResult.data) {
      throw new Error(tokenResult.error?.message || 'Failed to get access token');
    }

    // 获取用户信息
    const userInfoResult = await this.oauthService.wechat.getUserInfo(
      tokenResult.data.access_token,
      tokenResult.data.openid,
    );

    if (!userInfoResult.success || !userInfoResult.data) {
      throw new Error(userInfoResult.error?.message || 'Failed to get user info');
    }

    const userInfo = userInfoResult.data;

    // TODO: 根据 openid 查询或创建用户
    // const user = await this.userService.findOrCreateByWechatOpenId(userInfo.unionid);

    return {
      openid: userInfo.openid,
      unionid: userInfo.unionid,
      nickname: userInfo.nickname,
      avatar: userInfo.headimgurl,
    };
  }

  /**
   * 处理微信公众号回调
   */
  async handleWechatMpCallback(code: string) {
    const tokenResult = await this.oauthService.wechat.getAccessToken('mp', code);

    if (!tokenResult.success || !tokenResult.data) {
      throw new Error(tokenResult.error?.message || 'Failed to get access token');
    }

    const userInfoResult = await this.oauthService.wechat.getUserInfo(
      tokenResult.data.access_token,
      tokenResult.data.openid,
    );

    if (!userInfoResult.success || !userInfoResult.data) {
      throw new Error(userInfoResult.error?.message || 'Failed to get user info');
    }

    const userInfo = userInfoResult.data;

    // TODO: 根据 openid 查询或创建用户
    // const user = await this.userService.findOrCreateByWechatMpOpenId(userInfo.openid);

    return {
      openid: userInfo.openid,
      nickname: userInfo.nickname,
      avatar: userInfo.headimgurl,
    };
  }

  /**
   * 小程序登录
   */
  async miniprogramLogin(code: string) {
    const result = await this.oauthService.wechat.code2Session(code);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to login');
    }

    // TODO: 根据 openid 查询或创建用户
    // const user = await this.userService.findOrCreateByWechatMiniOpenId(result.data.openid);

    return {
      openid: result.data.openid,
      sessionKey: result.data.session_key,
      unionid: result.data.unionid,
    };
  }

  /**
   * 小程序获取手机号
   * @param code 手机号授权码
   * @param accessToken 小程序 access_token（需要先调用 getAccessToken 获取）
   */
  async getMiniprogramPhoneNumber(code: string, accessToken: string) {
    const result = await this.oauthService.wechat.getPhoneNumber(code, accessToken);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to get phone number');
    }

    return {
      phoneNumber: result.data.phoneNumber,
      purePhoneNumber: result.data.purePhoneNumber,
      countryCode: result.data.countryCode,
    };
  }
}
