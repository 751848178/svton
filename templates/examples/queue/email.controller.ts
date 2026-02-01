import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailData } from './email.processor';

@Controller('examples/emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async send(@Body() data: EmailData) {
    await this.emailService.sendEmail(data);
    return { message: 'Email queued successfully' };
  }

  @Post('send-delayed')
  async sendDelayed(
    @Body() data: EmailData & { delayMs: number },
  ) {
    await this.emailService.sendEmailDelayed(data, data.delayMs);
    return { message: `Email will be sent after ${data.delayMs}ms` };
  }

  @Post('send-batch')
  async sendBatch(@Body() data: { emails: EmailData[] }) {
    await this.emailService.sendBatchEmails(data.emails);
    return { message: `${data.emails.length} emails queued successfully` };
  }

  @Post('send-urgent')
  async sendUrgent(@Body() data: EmailData) {
    await this.emailService.sendUrgentEmail(data);
    return { message: 'Urgent email queued successfully' };
  }
}
