import { Injectable } from "@nestjs/common";
import { createTransport } from "nodemailer";
import type { AlertNotificationSmtpConfig } from "./monitoring-notification-delivery-config.types";
import type { AlertEmailSendResult } from "./monitoring-notification-delivery-dispatch.types";
import type { AlertEmailPayload } from "./monitoring-notification-delivery-payload.types";

@Injectable()
export class MonitoringNotificationDeliveryEmailSenderService {
  async sendEmail(
    payload: AlertEmailPayload,
    smtp: AlertNotificationSmtpConfig,
  ): Promise<AlertEmailSendResult> {
    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user
        ? { user: smtp.user, pass: smtp.password || "" }
        : undefined,
      connectionTimeout: smtp.timeoutMs,
      greetingTimeout: smtp.timeoutMs,
      socketTimeout: smtp.timeoutMs,
    });

    try {
      const info = await transporter.sendMail({
        from: smtp.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
      return {
        sent: true,
        responseBody: this.truncate(
          JSON.stringify({
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
          }),
          2000,
        ),
      };
    } catch (err) {
      return {
        sent: false,
        error: err instanceof Error ? err.message : "Email send failed",
      };
    }
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
