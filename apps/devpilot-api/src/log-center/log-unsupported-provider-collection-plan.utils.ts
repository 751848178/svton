import { toJsonValue } from "./log-center-value.utils";
import {
  LogCollectionExecutionResult,
  LogProviderCollectionPlanOptions,
  LogProviderCollectionPlanStream,
} from "./log-provider-collection-plan.types";

export function buildUnsupportedProviderCollectionPlan(
  stream: LogProviderCollectionPlanStream,
  runId: string,
  options: LogProviderCollectionPlanOptions,
): LogCollectionExecutionResult {
  const adapterKey = `${stream.sourceType}-log-provider-plan`;
  const warnings = [`${stream.sourceType} 日志流暂不支持自动采集。`];
  const error = warnings[0];

  return {
    status: "blocked",
    executorKey: "provider-adapter",
    adapterKey,
    commandPlan: toJsonValue({
      executorKey: "provider-adapter",
      adapterKey,
      operationKey: `log.collect.${stream.sourceType}`,
      dryRun: options.dryRun,
      executable: false,
      target: {
        streamId: stream.id,
        managedResourceId: stream.managedResourceId,
        provider: stream.managedResource?.provider,
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
      },
      safety: {
        arbitraryShell: false,
        commandSource: "provider_adapter",
        liveExecutionDefault: "blocked_until_credential_adapter_ready",
      },
      warnings,
      metadata: {
        logStreamId: stream.id,
        logCollectionRunId: runId,
        params: options.params || {},
        tail: options.tail,
      },
    }),
    logs: toJsonValue([{ level: "warn", message: error }]),
    result: toJsonValue({
      mode: "blocked_unsupported_source",
      executed: false,
      executorKey: "provider-adapter",
      adapterKey,
      warnings,
      nextExecutorBoundary: "credential_provider_adapter",
    }),
    error,
  };
}
