import { Injectable } from "@nestjs/common";
import { RELEASE_GATE_CAPABILITIES } from "./release-gate-capability.catalog";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateEvaluation,
} from "./release-gate-catalog.types";

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
  list() {
    return RELEASE_GATE_CAPABILITIES.map((definition) => ({
      ...definition,
      available: false,
      providerKey: null,
      reasonCode: "provider_not_connected",
      reason: PROVIDER_UNAVAILABLE,
    }));
  }

  evaluate(definition: ReleaseGateDefinition): ReleaseGateEvaluation {
    const capability = definition.capabilityId
      ? this.find(definition.capabilityId)
      : null;
    return {
      ...definition,
      status: "unavailable",
      providerKey: capability?.providerKey ?? null,
      reasonCode: definition.capabilityId
        ? capability?.reasonCode ?? "provider_not_connected"
        : "target_capability_not_connected",
      reason: definition.capabilityId
        ? capability?.reason ?? PROVIDER_UNAVAILABLE
        : TARGET_UNAVAILABLE,
    };
  }

  private find(id: ReleaseGateCapabilityId) {
    return this.list().find((capability) => capability.id === id);
  }
}
