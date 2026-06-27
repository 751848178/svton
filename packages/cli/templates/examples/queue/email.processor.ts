import { Injectable } from '@nestjs/common';
import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@svton/nestjs-queue';
import { Job } from 'bullmq';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  /**
   * 处理发送邮件任务
   */
  @Process('send')
  async handleSend(job: Job<EmailData>) {
    const { to, subject, body } = job.data;
    
    console.log(`Sending email to ${to}...`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    
    // TODO: 实际项目中调用邮件服务
    // await this.emailService.send(to, subject, body);
    
    // 模拟发送延迟
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Email sent successfully to ${to}`);
    
    return { success: true, to };
  }

  /**
   * 处理批量发送任务
   */
  @Process('sendBatch')
  async handleSendBatch(job: Job<{ emails: EmailData[] }>) {
    const { emails } = job.data;
    
    console.log(`Sending ${emails.length} emails...`);
    
    for (const email of emails) {
      await this.handleSend({ data: email } as Job<EmailData>);
    }
    
    return { success: true, count: emails.length };
  }

  /**
   * 任务完成回调
   */
  @OnQueueCompleted({ name: 'email' })
  async onCompleted(job: Job) {
    console.log(`Job ${job.id} completed successfully`);
  }

  /**
   * 任务失败回调
   */
  @OnQueueFailed({ name: 'email' })
  async onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed:`, error.message);
    // TODO: 发送告警通知
  }
}
