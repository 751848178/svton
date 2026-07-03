export type AlertNotificationSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  timeoutMs: number;
};
