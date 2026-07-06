import {
  isLiveSlsQueryConfirmed,
  positiveInt,
  readString,
  readStringArray,
  toJsonValue,
  toRecord,
} from "./log-center-value.utils";
import {
  LogCollectionExecutionResult,
  LogProviderCollectionPlanOptions,
  LogProviderCollectionPlanStream,
  SlsCollectionPlanContext,
} from "./log-provider-collection-plan.types";

export function buildSlsCollectionPlanContext(
  stream: LogProviderCollectionPlanStream,
  options: LogProviderCollectionPlanOptions,
  liveEnabled: boolean,
  liveAdapterKey: string,
): SlsCollectionPlanContext {
  const params = options.params || {};
  const config = toRecord(stream.managedResource?.config);
  const metadata = toRecord(stream.managedResource?.metadata);
  const logstores = readStringArray(config.logstores);
  const project =
    readString(params.project) ||
    readString(config.project) ||
    stream.managedResource?.name ||
    "unknown-project";
  const logstore =
    readString(params.logstore) ||
    readString(stream.sourceKey) ||
    readString(config.logstore) ||
    logstores[0] ||
    "default-logstore";
  const query = readString(params.query) || "*";
  const region =
    readString(params.region) || readString(metadata.region) || "default";
  const windowMinutes = positiveInt(params.windowMinutes, 15, 1440);
  const limit = positiveInt(
    params.limit,
    Math.min(options.tail || 100, 100),
    1000,
  );
  const to = new Date();
  const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
  const liveConfirmed = isLiveSlsQueryConfirmed(params);
  const credentialReady = Boolean(stream.managedResource?.credentialId);
  const warnings = [
    ...(!credentialReady
      ? ["SLS 日志流未绑定 TeamCredential，live 回填会被阻断。"]
      : []),
    ...(options.dryRun
      ? []
      : [
          ...(!liveEnabled
            ? [
                "SLS live 查询未启用，需要 LOG_CENTER_SLS_LIVE_QUERY_ENABLED=true。",
              ]
            : []),
          ...(!liveConfirmed
            ? ["SLS live 查询需要 params.confirmLiveRead=true。"]
            : []),
        ]),
  ];
  const executable = options.dryRun || warnings.length === 0;
  const status = executable ? "completed" : "blocked";

  return {
    params,
    config,
    metadata,
    project,
    logstore,
    query,
    region,
    from,
    to,
    windowMinutes,
    limit,
    liveEnabled,
    liveConfirmed,
    adapterKey: options.dryRun ? "aliyun-sls-query-plan" : liveAdapterKey,
    credentialReady,
    warnings,
    executable,
    status,
    error: status === "blocked" ? warnings.join("；") : undefined,
  };
}

export function buildSlsPlannedCollectionResult(
  options: LogProviderCollectionPlanOptions,
  context: SlsCollectionPlanContext,
): LogCollectionExecutionResult {
  const sampleLines = [
    `${context.from.toISOString()} INFO SLS dry-run query="${context.query}" project=${context.project} logstore=${context.logstore}`,
    `${context.to.toISOString()} INFO SLS live adapter requires explicit confirmation and feature flag`,
  ];

  return {
    status: context.status,
    executorKey: "cloud-sdk",
    adapterKey: context.adapterKey,
    logs: toJsonValue([
      {
        level: context.status === "completed" ? "info" : "warn",
        message: options.dryRun
          ? `SLS GetLogs dry-run 查询计划已生成: ${context.project}/${context.logstore}`
          : context.error,
      },
    ]),
    result: toJsonValue({
      mode: options.dryRun ? "dry_run_query_plan" : "blocked_live_execution",
      executed: false,
      executorKey: "cloud-sdk",
      adapterKey: context.adapterKey,
      provider: "aliyun-sls",
      query: {
        project: context.project,
        logstore: context.logstore,
        region: context.region,
        text: context.query,
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        limit: context.limit,
      },
      stdoutPreview: sampleLines.join("\n"),
      preview: {
        source: "contract_sample",
        sample: true,
        rows: sampleLines.map((line, index) => ({
          time:
            index === 0 ? context.from.toISOString() : context.to.toISOString(),
          level: index === 0 ? "info" : "warn",
          message: line,
        })),
        redaction: {
          enabled: true,
          policy: "mask_secret_like_fields_before_persisting",
        },
      },
      warnings: context.warnings,
      livePrerequisites: {
        credentialReady: context.credentialReady,
        adapterReady: true,
        liveEnabled: context.liveEnabled,
        confirmationReady: context.liveConfirmed,
      },
    }),
    error: context.error,
  };
}

export function canExecuteLiveSlsCollection(
  options: LogProviderCollectionPlanOptions,
  context: SlsCollectionPlanContext,
) {
  return !options.dryRun && context.executable;
}
