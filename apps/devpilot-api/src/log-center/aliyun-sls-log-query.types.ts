import { Prisma } from "@prisma/client";
import { LogRedactionPolicy } from "./log-redaction";

export type AliyunSlsCredentialConfig = {
  accessKeyId?: string;
  accessKeySecret?: string;
  securityToken?: string;
  defaultRegion?: string;
  slsEndpoint?: string;
  slsQueryTimeoutMs?: number | string;
  slsQueryRetryAttempts?: number | string;
  slsQueryRetryBaseDelayMs?: number | string;
};

export type AliyunSlsSdk = {
  Client: new (options: Record<string, unknown>) => AliyunSlsClient;
  GetLogsRequest: new (options: Record<string, unknown>) => unknown;
};

export type AliyunSlsClient = {
  getLogs(
    project: string,
    logstore: string,
    request: unknown,
  ): Promise<unknown>;
};

export type AliyunSlsLogQueryInput = {
  teamId: string;
  credentialId?: string | null;
  project: string;
  logstore: string;
  region: string;
  endpoint?: string;
  query: string;
  from: Date;
  to: Date;
  limit: number;
  redactionPolicy: LogRedactionPolicy;
};

export type AliyunSlsLogQueryResult = {
  status: "completed" | "failed" | "blocked";
  logs: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
  error?: string;
};
