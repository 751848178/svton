import { Controller, Get, Query, Redirect, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('examples/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 微信开放平台登录 - 获取授权 URL
   */
  @Get('wechat/open/login')
  @Redirect()
  wechatOpenLogin(@Query('redirect') redirect?: string) {
    const state = redirect || '/';
    const url = this.authService.getWechatOpenAuthUrl(state);

    return { url };
  }

  /**
   * 微信开放平台登录 - 回调处理
   */
  @Get('wechat/open/callback')
  async wechatOpenCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const userInfo = await this.authService.handleWechatOpenCallback(code);

    // TODO: 生成 JWT token
    // const token = await this.jwtService.sign({ userId: user.id });

    return {
      message: 'Login successful',
      userInfo,
      redirectUrl: state,
      // token,
    };
  }

  /**
   * 微信公众号登录 - 获取授权 URL
   */
  @Get('wechat/mp/login')
  @Redirect()
  wechatMpLogin(@Query('redirect') redirect?: string) {
    const state = redirect || '/';
    const url = this.authService.getWechatMpAuthUrl(state);

    return { url };
  }

  /**
   * 微信公众号登录 - 回调处理
   */
  @Get('wechat/mp/callback')
  async wechatMpCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const userInfo = await this.authService.handleWechatMpCallback(code);

    return {
      message: 'Login successful',
      userInfo,
      redirectUrl: state,
    };
  }

  /**
   * 小程序登录
   */
  @Post('wechat/miniprogram/login')
  async miniprogramLogin(@Body() body: { code: string }) {
    const result = await this.authService.miniprogramLogin(body.code);

    // TODO: 生成 JWT token
    // const token = await this.jwtService.sign({ userId: user.id });

    return {
      message: 'Login successful',
      ...result,
      // token,
    };
  }

  /**
   * 小程序获取手机号
   */
  @Post('wechat/miniprogram/phone')
  async getMiniprogramPhone(@Body() body: { code: string }) {
    const result = await this.authService.getMiniprogramPhoneNumber(body.code);

    return {
      message: 'Phone number retrieved successfully',
      ...result,
    };
  }
}
