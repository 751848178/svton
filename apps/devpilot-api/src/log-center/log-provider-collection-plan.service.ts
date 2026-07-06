import { Injectable } from "@nestjs/common";
import { AliyunSlsLogQueryAdapter } from "./aliyun-sls-log-query.adapter";
import { readString } from "./log-center-value.utils";
import {
  LogCollectionExecutionResult,
  LogProviderCollectionPlanOptions,
  LogProviderCollectionPlanStream,
} from "./log-provider-collection-plan.types";
import {
  buildSlsCollectionPlanContext,
  buildSlsPlannedCollectionResult,
  canExecuteLiveSlsCollection,
} from "./log-sls-collection-plan.utils";
import { buildSlsCollectionCommandPlan } from "./log-sls-collection-command-plan.utils";
import { buildUnsupportedProviderCollectionPlan } from "./log-unsupported-provider-collection-plan.utils";
import { resolveLogRedactionPolicy } from "./log-redaction";

@Injectable()
export class LogProviderCollectionPlanService {
  constructor(
    private readonly aliyunSlsLogQueryAdapter: AliyunSlsLogQueryAdapter,
  ) {}

  async buildPlan(
    stream: LogProviderCollectionPlanStream,
    runId: string,
    options: LogProviderCollectionPlanOptions,
  ): Promise<LogCollectionExecutionResult> {
    if (stream.sourceType !== "sls") {
      return buildUnsupportedProviderCollectionPlan(stream, runId, options);
    }

    const context = buildSlsCollectionPlanContext(
      stream,
      options,
      this.aliyunSlsLogQueryAdapter.isLiveEnabled(),
      this.aliyunSlsLogQueryAdapter.adapterKey,
    );
    const commandPlan = buildSlsCollectionCommandPlan(
      stream,
      runId,
      options,
      context,
    );

    if (canExecuteLiveSlsCollection(options, context)) {
      const liveResult = await this.aliyunSlsLogQueryAdapter.query({
        teamId: stream.teamId,
        credentialId: stream.managedResource?.credentialId,
        project: context.project,
        logstore: context.logstore,
        region: context.region,
        endpoint:
          readString(context.config.endpoint) ||
          readString(context.metadata.endpoint),
        query: context.query,
        from: context.from,
        to: context.to,
        limit: context.limit,
        redactionPolicy: resolveLogRedactionPolicy(stream.metadata),
      });

      return {
        status: liveResult.status,
        executorKey: this.aliyunSlsLogQueryAdapter.key,
        adapterKey: this.aliyunSlsLogQueryAdapter.adapterKey,
        commandPlan,
        logs: liveResult.logs,
        result: liveResult.result,
        error: liveResult.error,
      };
    }

    return {
      ...buildSlsPlannedCollectionResult(options, context),
      commandPlan,
    };
  }
}
