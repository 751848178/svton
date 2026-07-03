import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CreateAlertNotificationChannelDto,
  UpdateAlertNotificationChannelDto,
} from "./dto/monitoring.dto";
import { MonitoringNotificationDeliveryConfigService } from "./monitoring-notification-delivery-config.service";
import type {
  AlertNotificationChannelSettings,
  AlertNotificationChannelType,
} from "./monitoring-notification-channel.types";

type NotificationChannelSettingsDto = Pick<
  CreateAlertNotificationChannelDto | UpdateAlertNotificationChannelDto,
  "webhookUrl" | "emailRecipients" | "emailSubjectPrefix"
>;

@Injectable()
export class MonitoringNotificationChannelSettingsService {
  constructor(
    private readonly notificationDeliveryConfigService: MonitoringNotificationDeliveryConfigService,
  ) {}

  buildSettings(
    channelType: AlertNotificationChannelType,
    dto: NotificationChannelSettingsDto,
  ): AlertNotificationChannelSettings {
    if (channelType === "email") {
      const emailRecipients = this.requireEmailRecipients(dto.emailRecipients);
      const emailSubjectPrefix =
        this.notificationDeliveryConfigService.readString(
          dto.emailSubjectPrefix,
        ) || "Devpilot Alert";
      return {
        config: this.buildEmailConfig(emailRecipients, emailSubjectPrefix),
        secretConfig: { emailRecipients, emailSubjectPrefix },
      };
    }

    const webhookUrl = this.requireWebhookUrl(dto.webhookUrl || "");
    return {
      config: this.buildWebhookConfig(channelType, webhookUrl),
      secretConfig: { webhookUrl },
    };
  }

  private requireWebhookUrl(value: string) {
    const webhookUrl = this.notificationDeliveryConfigService.readString(value);
    if (!webhookUrl) {
      throw new BadRequestException("通知 Webhook URL 不能为空");
    }
    try {
      const url = new URL(webhookUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("unsupported protocol");
      }
    } catch {
      throw new BadRequestException("Webhook URL 必须是有效的 HTTP/HTTPS 地址");
    }
    return webhookUrl;
  }

  private buildWebhookConfig(
    channelType: AlertNotificationChannelType,
    webhookUrl: string,
  ) {
    return {
      provider: channelType,
      method: "POST",
      target:
        this.notificationDeliveryConfigService.safeWebhookTarget(webhookUrl),
      liveEnabled: this.notificationDeliveryConfigService.webhooksEnabled(),
    };
  }

  private buildEmailConfig(
    emailRecipients: string[],
    emailSubjectPrefix: string,
  ) {
    return {
      provider: "email",
      method: "SMTP",
      target:
        this.notificationDeliveryConfigService.safeEmailTarget(emailRecipients),
      recipientCount: emailRecipients.length,
      subjectPrefix: emailSubjectPrefix,
      liveEnabled: this.notificationDeliveryConfigService.emailEnabled(),
    };
  }

  private requireEmailRecipients(value: unknown) {
    const recipients =
      this.notificationDeliveryConfigService.readEmailRecipients(value);
    if (recipients.length === 0) {
      throw new BadRequestException("邮件通知收件人不能为空");
    }
    if (recipients.length > 20) {
      throw new BadRequestException("邮件通知收件人最多 20 个");
    }
    return recipients;
  }
}
