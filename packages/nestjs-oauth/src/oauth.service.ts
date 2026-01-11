import { Injectable, Inject } from '@nestjs/common';
import { OAUTH_OPTIONS } from './constants';
import type { OAuthModuleOptions } from './interfaces';
import { WechatProvider } from './providers/wechat.provider';

@Injectable()
export class OAuthService {
  constructor(
    @Inject(OAUTH_OPTIONS) private readonly options: OAuthModuleOptions,
    private readonly wechatProvider: WechatProvider,
  ) {}

  /**
   * 获取微信 Provider
   */
  get wechat(): WechatProvider {
    return this.wechatProvider;
  }

  /**
   * 生成随机 state
   */
  async generateState(): Promise<string> {
    if (this.options.stateGenerator) {
      return this.options.stateGenerator();
    }
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * 验证 state
   */
  async validateState(state: string): Promise<boolean> {
    if (this.options.stateValidator) {
      return this.options.stateValidator(state);
    }
    return true;
  }
}
