import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AlertNotificationSmtpConfig } from "./monitoring-notification-delivery-config.types";

@Injectable()
export class MonitoringNotificationDeliveryConfigService {
  constructor(private readonly configService: ConfigService) {}

  webhooksEnabled() {
    const value = this.configService.get<string | boolean>(
      "ALERT_NOTIFICATION_WEBHOOKS_ENABLED",
      "false",
    );
    return value === true || value === "true" || value === "1";
  }

  webhookTimeoutMs() {
    const rawValue = this.configService.get<string | number>(
      "ALERT_NOTIFICATION_WEBHOOK_TIMEOUT_MS",
      5000,
    );
    const parsed =
      typeof rawValue === "number" ? rawValue : Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) return 5000;
    return Math.min(Math.max(parsed, 1000), 30000);
  }

  emailEnabled() {
    const value = this.configService.get<string | boolean>(
      "ALERT_NOTIFICATION_EMAIL_ENABLED",
      "false",
    );
    return value === true || value === "true" || value === "1";
  }

  smtpConfig(): AlertNotificationSmtpConfig {
    const host =
      this.readString(
        this.configService.get<string>("ALERT_NOTIFICATION_SMTP_HOST", ""),
      ) || "";
    const from =
      this.readString(
        this.configService.get<string>("ALERT_NOTIFICATION_EMAIL_FROM", ""),
      ) || "";
    const user = this.readString(
      this.configService.get<string>("ALERT_NOTIFICATION_SMTP_USER", ""),
    );
    const password = this.readString(
      this.configService.get<string>("ALERT_NOTIFICATION_SMTP_PASSWORD", ""),
    );
    const portValue = this.configService.get<string | number>(
      "ALERT_NOTIFICATION_SMTP_PORT",
      587,
    );
    const timeoutValue = this.configService.get<string | number>(
      "ALERT_NOTIFICATION_EMAIL_TIMEOUT_MS",
      10000,
    );
    const port =
      typeof portValue === "number"
        ? portValue
        : Number.parseInt(portValue, 10);
    const timeoutMs =
      typeof timeoutValue === "number"
        ? timeoutValue
        : Number.parseInt(timeoutValue, 10);
    const secureValue = this.configService.get<string | boolean>(
      "ALERT_NOTIFICATION_SMTP_SECURE",
      "false",
    );
    return {
      host,
      port: Number.isFinite(port)
        ? Math.min(Math.max(Math.floor(port), 1), 65535)
        : 587,
      secure:
        secureValue === true || secureValue === "true" || secureValue === "1",
      user,
      password,
      from,
      timeoutMs: Number.isFinite(timeoutMs)
        ? Math.min(Math.max(Math.floor(timeoutMs), 1000), 30000)
        : 10000,
    };
  }

  safeWebhookTarget(webhookUrl: string) {
    try {
      const url = new URL(webhookUrl);
      const suffix = url.pathname && url.pathname !== "/" ? "/..." : "";
      return `${url.protocol}//${url.host}${suffix}`;
    } catch {
      return "invalid-webhook-url";
    }
  }

  safeEmailTarget(recipients: string[]) {
    if (recipients.length === 0) {
      return "email:unconfigured";
    }
    const [first, ...rest] = recipients;
    return rest.length > 0 ? `${first} +${rest.length}` : first;
  }

  readEmailRecipients(value: unknown) {
    const values = Array.isArray(value) ? value : [];
    const seen = new Set<string>();
    const recipients: string[] = [];
    for (const item of values) {
      if (typeof item !== "string") continue;
      const email = item.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException(`邮件通知收件人格式无效：${item}`);
      }
      seen.add(email);
      recipients.push(email);
    }
    return recipients;
  }

  readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
