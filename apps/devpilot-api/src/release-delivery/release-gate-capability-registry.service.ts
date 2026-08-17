import { Injectable } from "@nestjs/common";
import { RELEASE_GATE_CAPABILITIES } from "./release-gate-capability.catalog";
import { ReleaseGateArtifactCapabilityProvider } from "./release-gate-artifact-capability.provider";
import { ReleaseGateBuildCapabilityProvider } from "./release-gate-build-capability.provider";
import { ReleaseGateConfigCapabilityProvider } from "./release-gate-config-capability.provider";
import { ReleaseGateMigrationCapabilityProvider } from "./release-gate-migration-capability.provider";
import { ReleaseGateRuntimeCapabilityProvider } from "./release-gate-runtime-capability.provider";
import { ReleaseGateApprovalCapabilityProvider } from "./release-gate-approval-capability.provider";
import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { ReleaseGatePromotionCapabilityProvider } from "./release-gate-promotion-capability.provider";
import { ReleaseGateRecoveryStrategyProvider } from "./release-gate-recovery-strategy.provider";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateEvaluation,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import type { ReleaseGateCapabilityProvider } from "./release-gate-provider.types";
import { ReleaseGateSourceCapabilityProvider } from "./release-gate-source-capability.provider";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";

const PROVIDER_UNAVAILABLE = {
  zh: "尚未连接真实 Provider，未执行检查",
  en: "No real provider is connected; the check was not executed",
};

const TARGET_UNAVAILABLE = {
  zh: "该完整阶段能力尚未接入，不能视为通过",
  en: "This target-stage capability is not connected and cannot be treated as passed",
};

@Injectable()
export class ReleaseGateCapabilityRegistryService {
  private readonly providers: ReleaseGateCapabilityProvider[];

  constructor(
    source: ReleaseGateSourceCapabilityProvider,
    build: ReleaseGateBuildCapabilityProvider,
    artifact: ReleaseGateArtifactCapabilityProvider,
    config: ReleaseGateConfigCapabilityProvider,
    runtime: ReleaseGateRuntimeCapabilityProvider,
    migration: ReleaseGateMigrationCapabilityProvider,
    approval: ReleaseGateApprovalCapabilityProvider,
    ingress: ReleaseGateIngressCapabilityProvider,
    promotion: ReleaseGatePromotionCapabilityProvider,
    observability: ReleaseGateObservabilityCapabilityProvider,
    recovery: ReleaseGateRecoveryStrategyProvider,
    private readonly productionApplicability: ReleaseGateProductionApplicabilityProvider,
  ) {
    this.providers = [
      source, build, artifact, config, runtime, migration,
      approval, ingress, promotion, observability, recovery,
    ];
  }

  list(context: ReleaseGateEvidenceContext) {
    return RELEASE_GATE_CAPABILITIES.map((definition) => ({
      ...definition,
      ...this.capabilityState(definition.id, context),
    }));
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ): ReleaseGateEvaluation {
    const applicability = this.productionApplicability.evaluate(
      definition,
      context,
      now,
    );
    if (applicability) {
      return {
        ...definition,
        providerKey: this.productionApplicability.providerKey,
        ...applicability,
      };
    }
    const provider = definition.capabilityId
      ? this.findProvider(definition.capabilityId)
      : null;
    if (provider) {
      return {
        ...definition,
        providerKey: provider.providerKey,
        ...provider.evaluate(definition, context, now),
      };
    }
    return {
      ...definition,
      status: "unavailable",
      providerKey: null,
      reasonCode: definition.capabilityId ? "provider_not_connected" : "target_capability_not_connected",
      reason: definition.capabilityId ? PROVIDER_UNAVAILABLE : TARGET_UNAVAILABLE,
      evidenceRef: null,
      checkedAt: null,
      expiresAt: null,
      fresh: null,
    };
  }

  private capabilityState(
    id: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const provider = this.findProvider(id);
    if (!provider) {
      return {
        available: false,
        providerKey: null,
        reasonCode: "provider_not_connected",
        reason: PROVIDER_UNAVAILABLE,
      };
    }
    const available = provider.available(id, context);
    return {
      available,
      providerKey: provider.providerKey,
      reasonCode: available ? "provider_evidence_available" : "provider_evidence_unavailable",
      reason: available
        ? { zh: "真实 Provider 证据可用", en: "Real provider evidence is available" }
        : { zh: "Provider 已接入，但当前对象缺少真实证据", en: "The provider is connected, but this object has no real evidence" },
    };
  }

  private findProvider(id: ReleaseGateCapabilityId) {
    return this.providers.find((provider) => provider.capabilityIds.includes(id));
  }
}
