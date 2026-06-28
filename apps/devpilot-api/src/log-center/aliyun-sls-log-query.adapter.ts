import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LogRedactionPolicy, redactLogMessage, redactLogValue } from './log-redaction';

type AliyunSlsCredentialConfig = {
  accessKeyId?: string;
  accessKeySecret?: string;
  securityToken?: string;
  defaultRegion?: string;
  slsEndpoint?: string;
  slsQueryTimeoutMs?: number | string;
  slsQueryRetryAttempts?: number | string;
  slsQueryRetryBaseDelayMs?: number | string;
};

type AliyunSlsSdk = {
  Client: new (options: Record<string, unknown>) => {
    getLogs(project: string, logstore: string, request: unknown): Promise<unknown>;
  };
  GetLogsRequest: new (options: Record<string, unknown>) => unknown;
};

type ProviderRequestPolicy = {
  timeoutMs: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  attempts: number;
  retries: number;
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
  status: 'completed' | 'failed' | 'blocked';
  logs: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
  error?: string;
};

@Injectable()
export class AliyunSlsLogQueryAdapter {
  readonly key = 'cloud-sdk';
  readonly adapterKey = 'aliyun-sls-live-query';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  isLiveEnabled() {
    return this.configService.get('LOG_CENTER_SLS_LIVE_QUERY_ENABLED', 'false') === 'true';
  }

  async query(input: AliyunSlsLogQueryInput): Promise<AliyunSlsLogQueryResult> {
    if (!this.isLiveEnabled()) {
      return this.blocked(input, 'SLS live log query is disabled');
    }

    if (!input.credentialId) {
      return this.blocked(input, 'SLS 日志资源未绑定 TeamCredential');
    }

    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: input.credentialId, teamId: input.teamId },
      select: { id: true, name: true, type: true, config: true },
    });

    if (!credential) {
      return this.blocked(input, 'SLS TeamCredential 不存在或不属于当前团队');
    }
    if (credential.type !== 'cloud_aliyun') {
      return this.blocked(input, 'SLS live 查询需要 cloud_aliyun TeamCredential');
    }

    let requestPolicy: ProviderRequestPolicy | undefined;
    try {
      const credentialConfig = this.parseCredentialConfig<AliyunSlsCredentialConfig>(credential.config);
      const accessKeyId = this.asString(credentialConfig.accessKeyId);
      const accessKeySecret = this.asString(credentialConfig.accessKeySecret);

      if (!accessKeyId || !accessKeySecret) {
        return this.blocked(input, 'Aliyun credential 缺少 accessKeyId 或 accessKeySecret');
      }

      const slsSdk = await this.loadAliyunSlsSdk();
      if (!slsSdk) {
        return this.blocked(input, '@alicloud/sls20201230 is not available to Devpilot API');
      }

      requestPolicy = this.createProviderRequestPolicy(credentialConfig);
      const endpoint = input.endpoint || this.asString(credentialConfig.slsEndpoint) || `${input.region}.log.aliyuncs.com`;
      const client = new slsSdk.Client({
        accessKeyId,
        accessKeySecret,
        securityToken: this.asString(credentialConfig.securityToken),
        regionId: input.region,
        endpoint,
      });
      const rows = await this.getLogsPages(client, slsSdk, input, requestPolicy);
      const redactedRows = rows.map((row) => redactLogValue(row, input.redactionPolicy)) as Array<Record<string, unknown>>;
      const lines = redactedRows.map((row) => this.formatLogLine(row, input.redactionPolicy));

      return {
        status: 'completed',
        logs: this.toJsonValue([
          {
            level: 'info',
            message: `SLS GetLogs live 查询完成: ${input.project}/${input.logstore} ${rows.length} 条`,
          },
        ]),
        result: this.toJsonValue({
          mode: 'aliyun_sls_live_query',
          executed: true,
          executorKey: this.key,
          adapterKey: this.adapterKey,
          provider: 'aliyun-sls',
          sdk: '@alicloud/sls20201230',
          query: this.querySummary(input, endpoint),
          rowCount: rows.length,
          stdoutPreview: lines.join('\n'),
          preview: {
            source: 'aliyun_sls_get_logs',
            sample: false,
            rows: redactedRows.slice(0, 100),
            redaction: {
              enabled: true,
              policy: 'stream_redaction_policy',
            },
          },
          requestPolicy: this.summarizeRequestPolicy(requestPolicy),
        }),
      };
    } catch (error) {
      const message = `Aliyun SLS live log query failed: ${this.providerErrorMessage(error)}`;
      return {
        status: 'failed',
        logs: this.toJsonValue([{ level: 'error', message }]),
        result: this.toJsonValue({
          mode: 'aliyun_sls_live_query_failed',
          executed: true,
          executorKey: this.key,
          adapterKey: this.adapterKey,
          provider: 'aliyun-sls',
          query: this.querySummary(input),
          requestPolicy: requestPolicy ? this.summarizeRequestPolicy(requestPolicy) : undefined,
        }),
        error: message,
      };
    }
  }

  private async getLogsPages(
    client: { getLogs(project: string, logstore: string, request: unknown): Promise<unknown> },
    slsSdk: AliyunSlsSdk,
    input: AliyunSlsLogQueryInput,
    requestPolicy: ProviderRequestPolicy,
  ) {
    const rows: Array<Record<string, unknown>> = [];
    const maxRows = Math.max(1, Math.min(Math.floor(input.limit), 1000));
    const pageSize = Math.min(maxRows, 100);
    const fromSeconds = Math.floor(input.from.getTime() / 1000);
    const toSeconds = Math.max(fromSeconds + 1, Math.floor(input.to.getTime() / 1000));

    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const response = await this.executeProviderCall(
        requestPolicy,
        `Aliyun SLS GetLogs ${input.project}/${input.logstore} offset ${offset}`,
        () => client.getLogs(input.project, input.logstore, new slsSdk.GetLogsRequest({
          from: fromSeconds,
          to: toSeconds,
          query: input.query,
          line: Math.min(pageSize, maxRows - offset),
          offset,
          reverse: true,
        })),
      );
      const pageRows = this.readResponseRows(response);
      rows.push(...pageRows);

      if (pageRows.length < pageSize || rows.length >= maxRows || this.queryContainsAnalyticSql(input.query)) {
        break;
      }
    }

    return rows.slice(0, maxRows);
  }

  private readResponseRows(response: unknown): Array<Record<string, unknown>> {
    const record = this.asRecord(response);
    const body = record.body;
    if (Array.isArray(body)) {
      return body.filter((item): item is Record<string, unknown> => this.isRecord(item));
    }

    const bodyRecord = this.asRecord(body);
    for (const key of ['logs', 'data', 'items', 'rows']) {
      const value = bodyRecord[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => this.isRecord(item));
      }
    }

    return [];
  }

  private formatLogLine(row: Record<string, unknown>, redactionPolicy: LogRedactionPolicy) {
    const timestamp = this.resolveRowTimestamp(row);
    const level = this.asString(row.level) || this.asString(row.Level) || 'info';
    const message = this.resolveRowMessage(row);
    return redactLogMessage(`${timestamp.toISOString()} ${level.toUpperCase()} ${message}`, redactionPolicy);
  }

  private resolveRowTimestamp(row: Record<string, unknown>) {
    const raw = row.__time__ ?? row.time ?? row.timestamp ?? row.Time;
    const numeric = typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw)
        ? Number.parseInt(raw, 10)
        : null;
    if (numeric !== null && Number.isFinite(numeric)) {
      const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof raw === 'string') {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  private resolveRowMessage(row: Record<string, unknown>) {
    const direct = this.asString(row.message)
      || this.asString(row.Message)
      || this.asString(row.content)
      || this.asString(row.msg)
      || this.asString(row.log);
    if (direct) return direct;

    const material: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (['__time__', 'time', 'timestamp', 'Time', 'level', 'Level'].includes(key)) continue;
      material[key] = value;
    }
    return JSON.stringify(material);
  }

  private blocked(input: AliyunSlsLogQueryInput, error: string): AliyunSlsLogQueryResult {
    return {
      status: 'blocked',
      logs: this.toJsonValue([{ level: 'warn', message: error }]),
      result: this.toJsonValue({
        mode: 'blocked_live_execution',
        executed: false,
        executorKey: this.key,
        adapterKey: this.adapterKey,
        provider: 'aliyun-sls',
        query: this.querySummary(input),
        warnings: [error],
      }),
      error,
    };
  }

  private querySummary(input: AliyunSlsLogQueryInput, endpoint?: string) {
    return {
      project: input.project,
      logstore: input.logstore,
      region: input.region,
      endpoint,
      text: input.query,
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      limit: input.limit,
    };
  }

  private parseCredentialConfig<T extends Record<string, unknown>>(encryptedConfig: string): T {
    try {
      return JSON.parse(this.decrypt(encryptedConfig)) as T;
    } catch (error) {
      if (encryptedConfig.trim().startsWith('{')) {
        return JSON.parse(encryptedConfig) as T;
      }
      throw error;
    }
  }

  private decrypt(text: string) {
    const [ivHex, authTagHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey(), 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private encryptionKey() {
    return this.configService.get('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!');
  }

  private async loadAliyunSlsSdk(): Promise<AliyunSlsSdk | null> {
    try {
      const mod = await import('@alicloud/sls20201230');
      const moduleRecord = mod as unknown as Record<string, unknown>;
      return {
        Client: (moduleRecord.default || mod) as AliyunSlsSdk['Client'],
        GetLogsRequest: moduleRecord.GetLogsRequest as AliyunSlsSdk['GetLogsRequest'],
      };
    } catch {
      return null;
    }
  }

  private createProviderRequestPolicy(config: AliyunSlsCredentialConfig): ProviderRequestPolicy {
    return {
      timeoutMs: this.asPositiveInt(
        config.slsQueryTimeoutMs ?? this.configService.get('LOG_CENTER_SLS_QUERY_TIMEOUT_MS', '10000'),
        10000,
        120000,
      ),
      retryAttempts: this.asNonNegativeInt(
        config.slsQueryRetryAttempts ?? this.configService.get('LOG_CENTER_SLS_QUERY_RETRY_ATTEMPTS', '1'),
        1,
        5,
      ),
      retryBaseDelayMs: this.asPositiveInt(
        config.slsQueryRetryBaseDelayMs ?? this.configService.get('LOG_CENTER_SLS_QUERY_RETRY_BASE_DELAY_MS', '200'),
        200,
        10000,
      ),
      attempts: 0,
      retries: 0,
    };
  }

  private summarizeRequestPolicy(policy: ProviderRequestPolicy) {
    return {
      timeoutMs: policy.timeoutMs,
      retryAttempts: policy.retryAttempts,
      retryBaseDelayMs: policy.retryBaseDelayMs,
      attempts: policy.attempts,
      retries: policy.retries,
    };
  }

  private async executeProviderCall<T>(
    policy: ProviderRequestPolicy,
    label: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= policy.retryAttempts; attempt += 1) {
      policy.attempts += 1;
      try {
        return await this.withTimeout(fn(), policy.timeoutMs, label);
      } catch (error) {
        lastError = error;
        const canRetry = attempt < policy.retryAttempts && this.isRetryableProviderError(error);
        if (!canRetry) break;
        policy.retries += 1;
        await this.sleep(policy.retryBaseDelayMs * (attempt + 1));
      }
    }

    throw lastError;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private sleep(ms: number) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableProviderError(error: unknown) {
    const message = this.providerErrorMessage(error).toLowerCase();
    return [
      'timeout',
      'timed out',
      'throttl',
      'rate',
      'too many',
      'temporarily unavailable',
      'serviceunavailable',
      'internalerror',
      'econnreset',
      'etimedout',
    ].some((pattern) => message.includes(pattern));
  }

  private providerErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (this.isRecord(error)) {
      return this.asString(error.message) || this.asString(error.Message) || JSON.stringify(error);
    }
    return String(error);
  }

  private queryContainsAnalyticSql(query: string) {
    return query.includes('|') || /\bselect\b/i.test(query);
  }

  private asPositiveInt(value: unknown, fallback: number, max?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    const intValue = Math.floor(parsed);
    return max ? Math.min(intValue, max) : intValue;
  }

  private asNonNegativeInt(value: unknown, fallback: number, max?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    const intValue = Math.floor(parsed);
    return max ? Math.min(intValue, max) : intValue;
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
