import type { AlertNotificationPayloadEvent } from "./monitoring-notification-delivery-payload.types";

export type AlertNotificationDispatchEvent = AlertNotificationPayloadEvent & {
  teamId: string;
};

export type AlertNotificationDeliveryWriteResult = {
  status: string;
  dryRun: boolean;
  target?: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  error?: string | null;
  attemptedAt?: Date;
};

export type AlertEmailSendResult = {
  sent: boolean;
  responseBody?: string;
  error?: string | null;
};
