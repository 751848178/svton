import { ReleaseGateApprovalCapabilityProvider } from "./release-gate-approval-capability.provider";
import { ReleaseGateArtifactCapabilityProvider } from "./release-gate-artifact-capability.provider";
import { ReleaseGateBuildCapabilityProvider } from "./release-gate-build-capability.provider";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateConfigCapabilityProvider } from "./release-gate-config-capability.provider";
import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { ReleaseGateMigrationCapabilityProvider } from "./release-gate-migration-capability.provider";
import { ReleaseGatePromotionCapabilityProvider } from "./release-gate-promotion-capability.provider";
import { ReleaseGateRecoveryStrategyProvider } from "./release-gate-recovery-strategy.provider";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import { ReleaseGateRuntimeCapabilityProvider } from "./release-gate-runtime-capability.provider";
import { ReleaseGateSourceCapabilityProvider } from "./release-gate-source-capability.provider";

export function createReleaseGateRegistry() {
  return new ReleaseGateCapabilityRegistryService(
    new ReleaseGateSourceCapabilityProvider(),
    new ReleaseGateBuildCapabilityProvider(),
    new ReleaseGateArtifactCapabilityProvider(),
    new ReleaseGateConfigCapabilityProvider(),
    new ReleaseGateRuntimeCapabilityProvider(),
    new ReleaseGateMigrationCapabilityProvider(),
    new ReleaseGateApprovalCapabilityProvider(),
    new ReleaseGateIngressCapabilityProvider(),
    new ReleaseGatePromotionCapabilityProvider(),
    new ReleaseGateObservabilityCapabilityProvider(),
    new ReleaseGateRecoveryStrategyProvider(),
  );
}
