import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import type { ReleaseGateCapabilityProvider } from "./release-gate-provider.types";
import { evaluateReleaseGateAnalysis } from "./release-gate-source-analysis-evaluator";
import { evaluateReleaseGateSource } from "./release-gate-source-connection-evaluator";

@Injectable()
export class ReleaseGateSourceCapabilityProvider implements ReleaseGateCapabilityProvider {
  readonly providerKey = "repository_commit_analysis";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M01", "M02"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return capabilityId === "M01"
      ? Boolean(context.project.repositoryConnection)
      : Boolean(context.project.repositoryAnalysisRuns[0]);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    return definition.capabilityId === "M01"
      ? evaluateReleaseGateSource(definition.id, context, now)
      : evaluateReleaseGateAnalysis(definition.id, context, now);
  }
}
