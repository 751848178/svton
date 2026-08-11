import { ConflictException } from "@nestjs/common";
import type { ReleaseDeploymentTargetReadiness } from "./release-deployment-target-readiness.model";

const MESSAGES = {
  TARGET_READY: "部署目标已就绪",
  TARGET_MISSING: "当前环境未绑定部署目标",
  TARGET_DUPLICATED: "当前环境存在重复的部署目标绑定",
  PROVIDER_MISMATCH: "部署目标与当前 Provider 不匹配",
  SSH_ROOT_INVALID: "SSH 部署根目录缺失或不安全",
  SSH_CONNECTION_INVALID: "SSH 服务器未在线或连接信息无效",
} as const;

export class ReleaseDeploymentTargetConflict extends ConflictException {
  constructor(readiness: ReleaseDeploymentTargetReadiness) {
    super({
      code: readiness.reasonCode,
      message: MESSAGES[readiness.reasonCode],
      publicData: {
        expectedProviderKey: readiness.expectedProviderKey,
        bindingCount: readiness.bindingCount,
        matchState: readiness.matchState,
        remediation: readiness.remediation,
      },
    });
  }
}
