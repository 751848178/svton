import { Prisma } from "@prisma/client";
import { ProviderRequestPolicy } from "../common/retry/provider-retry";
import {
  AliyunSlsLogQueryInput,
  AliyunSlsLogQueryResult,
} from "./aliyun-sls-log-query.types";
import { summarizeAliyunSlsRequestPolicy } from "./aliyun-sls-log-query-policy.utils";

type AdapterIdentity = {
  executorKey: string;
  adapterKey: string;
};

type CompletedResultParams = AdapterIdentity & {
  input: AliyunSlsLogQueryInput;
  endpoint: string;
  rowCount: number;
  lines: string[];
  rows: Array<Record<string, unknown>>;
  requestPolicy: ProviderRequestPolicy;
};

type FailedResultParams = AdapterIdentity & {
  input: AliyunSlsLogQueryInput;
  requestPolicy?: ProviderRequestPolicy;
  message: string;
};

export function buildAliyunSlsCompletedResult(
  params: CompletedResultParams,
): AliyunSlsLogQueryResult {
  return {
    status: "completed",
    logs: toJsonValue([
      {
        level: "info",
        message: `SLS GetLogs live 查询完成: ${params.input.project}/${params.input.logstore} ${params.rowCount} 条`,
      },
    ]),
    result: toJsonValue({
      mode: "aliyun_sls_live_query",
      executed: true,
      executorKey: params.executorKey,
      adapterKey: params.adapterKey,
      provider: "aliyun-sls",
      sdk: "@alicloud/sls20201230",
      query: buildAliyunSlsQuerySummary(params.input, params.endpoint),
      rowCount: params.rowCount,
      stdoutPreview: params.lines.join("\n"),
      preview: {
        source: "aliyun_sls_get_logs",
        sample: false,
        rows: params.rows.slice(0, 100),
        redaction: {
          enabled: true,
          policy: "stream_redaction_policy",
        },
      },
      requestPolicy: summarizeAliyunSlsRequestPolicy(params.requestPolicy),
    }),
  };
}

export function buildAliyunSlsFailedResult(
  params: FailedResultParams,
): AliyunSlsLogQueryResult {
  return {
    status: "failed",
    logs: toJsonValue([{ level: "error", message: params.message }]),
    result: toJsonValue({
      mode: "aliyun_sls_live_query_failed",
      executed: true,
      executorKey: params.executorKey,
      adapterKey: params.adapterKey,
      provider: "aliyun-sls",
      query: buildAliyunSlsQuerySummary(params.input),
      requestPolicy: params.requestPolicy
        ? summarizeAliyunSlsRequestPolicy(params.requestPolicy)
        : undefined,
    }),
    error: params.message,
  };
}

export function buildAliyunSlsBlockedResult(
  input: AliyunSlsLogQueryInput,
  identity: AdapterIdentity,
  error: string,
): AliyunSlsLogQueryResult {
  return {
    status: "blocked",
    logs: toJsonValue([{ level: "warn", message: error }]),
    result: toJsonValue({
      mode: "blocked_live_execution",
      executed: false,
      executorKey: identity.executorKey,
      adapterKey: identity.adapterKey,
      provider: "aliyun-sls",
      query: buildAliyunSlsQuerySummary(input),
      warnings: [error],
    }),
    error,
  };
}

export function buildAliyunSlsQuerySummary(
  input: AliyunSlsLogQueryInput,
  endpoint?: string,
) {
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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
