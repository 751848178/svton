import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import {
  ProviderRequestPolicy,
  providerErrorMessage,
} from "../common/retry/provider-retry";
import { getAliyunSlsLogPages } from "./aliyun-sls-log-query-pages.utils";
import { createAliyunSlsProviderRequestPolicy } from "./aliyun-sls-log-query-policy.utils";
import {
  buildAliyunSlsBlockedResult,
  buildAliyunSlsCompletedResult,
  buildAliyunSlsFailedResult,
} from "./aliyun-sls-log-query-result.utils";
import {
  formatAliyunSlsLogLine,
  redactAliyunSlsRows,
} from "./aliyun-sls-log-query-rows.utils";
import {
  AliyunSlsCredentialConfig,
  AliyunSlsLogQueryInput,
  AliyunSlsLogQueryResult,
  AliyunSlsSdk,
} from "./aliyun-sls-log-query.types";
export type {
  AliyunSlsLogQueryInput,
  AliyunSlsLogQueryResult,
} from "./aliyun-sls-log-query.types";

@Injectable()
export class AliyunSlsLogQueryAdapter {
  readonly key = "cloud-sdk";
  readonly adapterKey = "aliyun-sls-live-query";

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  isLiveEnabled() {
    return (
      this.configService.get("LOG_CENTER_SLS_LIVE_QUERY_ENABLED", "false") ===
      "true"
    );
  }

  private get identity() {
    return { executorKey: this.key, adapterKey: this.adapterKey };
  }

  async query(input: AliyunSlsLogQueryInput): Promise<AliyunSlsLogQueryResult> {
    if (!this.isLiveEnabled()) {
      return this.blocked(input, "SLS live log query is disabled");
    }

    if (!input.credentialId) {
      return this.blocked(input, "SLS 日志资源未绑定 TeamCredential");
    }

    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: input.credentialId, teamId: input.teamId },
      select: { id: true, name: true, type: true, config: true },
    });

    if (!credential) {
      return this.blocked(input, "SLS TeamCredential 不存在或不属于当前团队");
    }
    if (credential.type !== "cloud_aliyun") {
      return this.blocked(
        input,
        "SLS live 查询需要 cloud_aliyun TeamCredential",
      );
    }

    let requestPolicy: ProviderRequestPolicy | undefined;
    try {
      const credentialConfig =
        this.parseCredentialConfig<AliyunSlsCredentialConfig>(
          credential.config,
        );
      const accessKeyId = this.asString(credentialConfig.accessKeyId);
      const accessKeySecret = this.asString(credentialConfig.accessKeySecret);

      if (!accessKeyId || !accessKeySecret) {
        return this.blocked(
          input,
          "Aliyun credential 缺少 accessKeyId 或 accessKeySecret",
        );
      }

      const slsSdk = await this.loadAliyunSlsSdk();
      if (!slsSdk) {
        return this.blocked(
          input,
          "@alicloud/sls20201230 is not available to Devpilot API",
        );
      }

      requestPolicy = createAliyunSlsProviderRequestPolicy(
        this.configService,
        credentialConfig,
      );
      const endpoint =
        input.endpoint ||
        this.asString(credentialConfig.slsEndpoint) ||
        `${input.region}.log.aliyuncs.com`;
      const client = new slsSdk.Client({
        accessKeyId,
        accessKeySecret,
        securityToken: this.asString(credentialConfig.securityToken),
        regionId: input.region,
        endpoint,
      });
      const rows = await getAliyunSlsLogPages(
        client,
        slsSdk,
        input,
        requestPolicy,
      );
      const redactedRows = redactAliyunSlsRows(rows, input.redactionPolicy);
      const lines = redactedRows.map((row) =>
        formatAliyunSlsLogLine(row, input.redactionPolicy),
      );

      return buildAliyunSlsCompletedResult({
        ...this.identity,
        input,
        endpoint,
        rowCount: rows.length,
        lines,
        rows: redactedRows,
        requestPolicy,
      });
    } catch (error) {
      const message = `Aliyun SLS live log query failed: ${providerErrorMessage(error)}`;
      return buildAliyunSlsFailedResult({
        ...this.identity,
        input,
        requestPolicy,
        message,
      });
    }
  }

  private blocked(
    input: AliyunSlsLogQueryInput,
    error: string,
  ): AliyunSlsLogQueryResult {
    return buildAliyunSlsBlockedResult(input, this.identity, error);
  }

  private parseCredentialConfig<T extends Record<string, unknown>>(
    encryptedConfig: string,
  ): T {
    try {
      return JSON.parse(this.decrypt(encryptedConfig)) as T;
    } catch (error) {
      if (encryptedConfig.trim().startsWith("{")) {
        return JSON.parse(encryptedConfig) as T;
      }
      throw error;
    }
  }

  private decrypt(text: string) {
    return this.cryptoService.decryptGcm(text);
  }

  private async loadAliyunSlsSdk(): Promise<AliyunSlsSdk | null> {
    try {
      const mod = await import("@alicloud/sls20201230");
      const moduleRecord = mod as unknown as Record<string, unknown>;
      return {
        Client: (moduleRecord.default || mod) as AliyunSlsSdk["Client"],
        GetLogsRequest:
          moduleRecord.GetLogsRequest as AliyunSlsSdk["GetLogsRequest"],
      };
    } catch {
      return null;
    }
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
