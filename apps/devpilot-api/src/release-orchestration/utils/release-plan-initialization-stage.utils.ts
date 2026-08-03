import type { ReleaseServiceInput } from "./release-plan-builder.utils";
import {
  BOOTSTRAP_RISK,
  makeStage,
  type StageCtx,
} from "./release-plan-stage-helpers.utils";

export function makeInitializationStage(
  svc: ReleaseServiceInput,
  ctx: StageCtx,
  command: string,
): {
  key: string;
  stage: ReturnType<typeof makeStage>;
  sideEffect: string;
  approvalReason: string;
} {
  const key = `bootstrap:${svc.applicationServiceId}`;
  return {
    key,
    stage: makeStage({
      key,
      name: `初始化数据 - ${svc.serviceName}`,
      type: "bootstrap",
      executorKind: "server_command",
      required: true,
      risk: BOOTSTRAP_RISK,
      ctx,
      config: {
        command,
        runPolicy: "once_per_environment_command",
        concurrencyKey: `bootstrap:${svc.applicationServiceId}:${svc.environmentId}`,
      },
    }),
    sideEffect: `${key}: 创建或更新初始化数据`,
    approvalReason: "初始化数据可能修改业务数据",
  };
}
