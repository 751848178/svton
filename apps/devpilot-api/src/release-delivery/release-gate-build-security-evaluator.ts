import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evidenceBuild } from "./release-gate-build-evidence.utils";
import { evaluateStructuredBuildResult } from "./release-gate-build-result-evaluator";
import { record, unavailable } from "./release-gate-provider.types";

export function evaluateBuildSecurityGate(
  id: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
) {
  const build = evidenceBuild(context);
  if (!build) {
    return unavailable(
      "security_build_missing",
      "没有可绑定安全证据的 BuildRun",
      "No BuildRun exists for security evidence",
    );
  }
  const key =
    id === "C07" ? "secretScan" : id === "C10" ? "sast" : "vulnerabilities";
  const evidence = record(record(record(build.gateSummary).security)[key]);
  if (Object.keys(evidence).length === 0) {
    return unavailable(
      `${key}_provider_missing`,
      `未连接 ${key} 安全工具 Provider；隔离与脱敏控制不能替代扫描`,
      `No ${key} security-tool provider is connected; isolation and redaction do not substitute for scanning`,
    );
  }
  return evaluateStructuredBuildResult(evidence, key, build, now);
}
