import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { evaluateReleaseBuildSastCapability } from "./release-build-sast-capability.policy";
import type { WorkerSourceManifestEntry } from "./release-build-worker-source-manifest";

export function assertReleaseBuildSastCapability(
  profile: RegisteredReleaseBuildProfile,
  entries: readonly WorkerSourceManifestEntry[],
) {
  const verdict = evaluateReleaseBuildSastCapability(
    profile.sastCapability,
    entries,
  );
  if (verdict.available) return;
  throw releaseBuildExecutionFailure(
    "BUILD_SAST_CAPABILITY_UNAVAILABLE",
    "当前固定 SAST 引擎不支持源码中的语言扩展名",
    [],
    "移除不受支持的源码，或配置具备对应规则能力的受控构建 profile。",
    "failed",
    { security: { sast: { status: "unavailable", ...verdict } } },
  );
}
