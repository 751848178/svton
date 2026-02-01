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

    // 获取用户信息
    const userInfo = await this.oauthService.wechat.getUserInfo(
      'open',
      tokenResult.access_token,
      tokenResult.openid,
    );

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

    const userInfo = await this.oauthService.wechat.getUserInfo(
      'mp',
      tokenResult.access_token,
      tokenResult.openid,
    );

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

    // TODO: 根据 openid 查询或创建用户
    // const user = await this.userService.findOrCreateByWechatMiniOpenId(result.openid);

    return {
      openid: result.openid,
      sessionKey: result.session_key,
      unionid: result.unionid,
    };
  }

  /**
   * 小程序获取手机号
   */
  async getMiniprogramPhoneNumber(code: string) {
    const result = await this.oauthService.wechat.getPhoneNumber(code);

    return {
      phoneNumber: result.phone_info.phoneNumber,
      purePhoneNumber: result.phone_info.purePhoneNumber,
      countryCode: result.phone_info.countryCode,
    };
  }
}
