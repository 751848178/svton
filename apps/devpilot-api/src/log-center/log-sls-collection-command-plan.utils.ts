import { toJsonValue } from "./log-center-value.utils";
import {
  LogProviderCollectionPlanOptions,
  LogProviderCollectionPlanStream,
  SlsCollectionPlanContext,
} from "./log-provider-collection-plan.types";

export function buildSlsCollectionCommandPlan(
  stream: LogProviderCollectionPlanStream,
  runId: string,
  options: LogProviderCollectionPlanOptions,
  context: SlsCollectionPlanContext,
) {
  const { from, to } = context;
  return toJsonValue({
    executorKey: "cloud-sdk",
    adapterKey: context.adapterKey,
    operationKey: "log.collect.sls.query",
    dryRun: options.dryRun,
    executable: context.executable,
    target: {
      streamId: stream.id,
      managedResourceId: stream.managedResourceId,
      provider: stream.managedResource?.provider || "aliyun-sls",
      sourceType: stream.sourceType,
      sourceKey: stream.sourceKey,
      project: context.project,
      logstore: context.logstore,
      region: context.region,
    },
    query: {
      type: "sls_query",
      text: context.query,
      from: from.toISOString(),
      to: to.toISOString(),
      windowMinutes: context.windowMinutes,
      limit: context.limit,
    },
    safety: {
      arbitraryShell: false,
      commandSource: "provider_sdk_adapter",
      readOnlyOnly: true,
      secretsInOutput: "must_mask_before_persisting",
      liveExecutionDefault: "requires_feature_flag_and_confirmLiveRead",
    },
    plannedCalls: [
      {
        provider: "aliyun-sls",
        operation: "GetLogs",
        params: {
          region: context.region,
          project: context.project,
          logstore: context.logstore,
          query: context.query,
          from: from.toISOString(),
          to: to.toISOString(),
          limit: context.limit,
        },
      },
    ],
    resultContract: {
      shape: "log_lines",
      columns: [
        { key: "time", label: "Time", type: "datetime", masked: false },
        { key: "level", label: "Level", type: "string", masked: false },
        { key: "message", label: "Message", type: "string", masked: true },
      ],
      rowLimitDefault: 100,
      rowLimitMax: 1000,
    },
    livePrerequisites: {
      credentialReady: context.credentialReady,
      adapterReady: true,
      liveEnabled: context.liveEnabled,
      confirmationReady: context.liveConfirmed,
      requiredConfirmation: "params.confirmLiveRead=true",
    },
    warnings: context.warnings,
    metadata: {
      logStreamId: stream.id,
      logCollectionRunId: runId,
      params: context.params,
      tail: options.tail,
      nextExecutorBoundary: "aliyun_sls_sdk_adapter",
    },
  });
}
