import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evidenceBuild } from "./release-gate-build-evidence.utils";
import { evaluateBuildQualityGate } from "./release-gate-build-quality-evaluator";
import { evaluateBuildSecurityGate } from "./release-gate-build-security-evaluator";
import {
  record,
  type ReleaseGateCapabilityProvider,
} from "./release-gate-provider.types";

@Injectable()
export class ReleaseGateBuildCapabilityProvider implements ReleaseGateCapabilityProvider {
  readonly providerKey = "build_quality_security";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M03", "M04"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const build = evidenceBuild(context);
    if (capabilityId === "M03") return Boolean(build);
    const security = record(record(build?.gateSummary).security);
    return ["secretScan", "sast", "vulnerabilities"].some((key) => {
      const evidence = record(security[key]);
      return (
        Object.keys(evidence).length > 0 &&
        evidence.status !== "unavailable" &&
        evidence.status !== "not_configured"
      );
    });
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    return definition.capabilityId === "M03"
      ? evaluateBuildQualityGate(definition.id, context, now)
      : evaluateBuildSecurityGate(definition.id, context, now);
  }
}
