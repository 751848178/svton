import { Body, Controller, Get, Inject, Post, Req, Res, HttpCode, Header } from '@nestjs/common';
import type { Response } from 'express';
import type { LocalRequest } from '../policy/request-context.js';
import { AuthService } from './auth.service.js';
import { AuthSettings, SESSION_COOKIE } from './settings.js';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(AuthSettings) private readonly settings: AuthSettings) {}
  @Post('login') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async login(@Body() body: Record<string, unknown>, @Req() request: LocalRequest, @Res({ passthrough: true }) response: Response) {
    const { view, token } = await this.auth.login(body, request);
    response.cookie(SESSION_COOKIE, token, { ...this.settings.cookie(), expires: new Date(view.expiresAt) });
    return view;
  }
  @Get('session') @Header('Cache-Control', 'no-store') session(@Req() request: LocalRequest) { return request.authentication!.view; }
  @Post('logout') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async logout(@Req() request: LocalRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request); response.clearCookie(SESSION_COOKIE, this.settings.cookie()); return { ok: true };
  }
}
