import { Injectable } from '@nestjs/common';
import { QueueService } from '@svton/nestjs-queue';
import { EmailData } from './email.processor';

@Injectable()
export class EmailService {
  constructor(private readonly queueService: QueueService) {}

  /**
   * 发送单个邮件
   */
  async sendEmail(data: EmailData): Promise<void> {
    await this.queueService.addJob('email', 'send', data);
  }

  /**
   * 延迟发送邮件
   */
  async sendEmailDelayed(data: EmailData, delayMs: number): Promise<void> {
    await this.queueService.addJob('email', 'send', data, {
      delay: delayMs,
    });
  }

  /**
   * 发送邮件（带重试）
   */
  async sendEmailWithRetry(data: EmailData): Promise<void> {
    await this.queueService.addJob('email', 'send', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  /**
   * 批量发送邮件
   */
  async sendBatchEmails(emails: EmailData[]): Promise<void> {
    await this.queueService.addJob('email', 'sendBatch', { emails });
  }

  /**
   * 定时发送邮件
   */
  async scheduleEmail(data: EmailData, cron: string): Promise<void> {
    await this.queueService.addJob('email', 'send', data, {
      repeat: {
        cron, // 例如: '0 9 * * *' 每天 9 点
      },
    });
  }

  /**
   * 高优先级邮件
   */
  async sendUrgentEmail(data: EmailData): Promise<void> {
    await this.queueService.addJob('email', 'send', data, {
      priority: 1, // 数字越小优先级越高
    });
  }
}
