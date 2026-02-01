import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { SmsService } from './sms.service';

interface SendCodeDto {
  phoneNumber: string;
}

interface VerifyCodeDto {
  phoneNumber: string;
  code: string;
}

@Controller('examples/verification')
export class VerificationController {
  // 简单的内存存储，实际项目应使用 Redis
  private verificationCodes = new Map<string, { code: string; expiresAt: number }>();

  constructor(private readonly smsService: SmsService) {}

  /**
   * 发送验证码
   */
  @Post('send-code')
  @HttpCode(200)
  async sendCode(@Body() dto: SendCodeDto) {
    // 生成 6 位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储验证码（5 分钟有效期）
    this.verificationCodes.set(dto.phoneNumber, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // 发送短信
    await this.smsService.sendVerificationCode(dto.phoneNumber, code);

    return {
      message: 'Verification code sent successfully',
      // 开发环境返回验证码，生产环境不应返回
      ...(process.env.NODE_ENV === 'development' && { code }),
    };
  }

  /**
   * 验证验证码
   */
  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(@Body() dto: VerifyCodeDto) {
    const stored = this.verificationCodes.get(dto.phoneNumber);

    if (!stored) {
      return {
        success: false,
        message: 'Verification code not found',
      };
    }

    if (Date.now() > stored.expiresAt) {
      this.verificationCodes.delete(dto.phoneNumber);
      return {
        success: false,
        message: 'Verification code expired',
      };
    }

    if (stored.code !== dto.code) {
      return {
        success: false,
        message: 'Invalid verification code',
      };
    }

    // 验证成功，删除验证码
    this.verificationCodes.delete(dto.phoneNumber);

    return {
      success: true,
      message: 'Verification successful',
    };
  }

  /**
   * 发送通知短信
   */
  @Post('send-notification')
  @HttpCode(200)
  async sendNotification(
    @Body() dto: { phoneNumber: string; message: string },
  ) {
    await this.smsService.sendNotification(dto.phoneNumber, {
      message: dto.message,
    });

    return {
      message: 'Notification sent successfully',
    };
  }
}
