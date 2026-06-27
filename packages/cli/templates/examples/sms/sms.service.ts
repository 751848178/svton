import { Injectable } from '@nestjs/common';
import { SmsService as SvtonSmsService } from '@svton/nestjs-sms';

@Injectable()
export class SmsService {
  constructor(private readonly smsService: SvtonSmsService) {}

  /**
   * 发送验证码短信
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    await this.smsService.send({
      phoneNumber,
      templateCode: 'SMS_123456', // TODO: 替换为实际的模板 ID
      templateParams: {
        code,
      },
    });
  }

  /**
   * 发送通知短信
   */
  async sendNotification(
    phoneNumber: string,
    params: Record<string, string>,
  ): Promise<void> {
    await this.smsService.send({
      phoneNumber,
      templateCode: 'SMS_234567', // TODO: 替换为实际的模板 ID
      templateParams: params,
    });
  }

  /**
   * 批量发送短信
   */
  async sendBatch(
    phoneNumbers: string[],
    templateCode: string,
    templateParams: Record<string, string>,
  ): Promise<void> {
    await Promise.all(
      phoneNumbers.map((phoneNumber) =>
        this.smsService.send({
          phoneNumber,
          templateCode,
          templateParams,
        }),
      ),
    );
  }

  /**
   * 发送营销短信
   */
  async sendMarketing(
    phoneNumber: string,
    content: string,
  ): Promise<void> {
    await this.smsService.send({
      phoneNumber,
      templateCode: 'SMS_345678', // TODO: 替换为实际的模板 ID
      templateParams: {
        content,
      },
    });
  }
}
