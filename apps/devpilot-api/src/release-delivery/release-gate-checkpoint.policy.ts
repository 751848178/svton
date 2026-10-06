import type { ReleaseGatePhase } from "./release-gate-catalog.types";
import type {
  ReleaseGateCheckpoint,
  ReleaseGateDecisionStage,
} from "./release-gate-decision.types";

export type ReleaseGateCheckpointPolicy = {
  stage: ReleaseGateDecisionStage;
  phase: ReleaseGatePhase;
  requiredGateIds: readonly string[];
};

export type ReleaseFlowProfile = "basic_v1" | "governed_v1";
export const ACTIVE_RELEASE_FLOW_PROFILE = releaseFlowProfileFromEnvironment();

export function releaseFlowProfileFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ReleaseFlowProfile {
  const profile = environment.DEVPILOT_RELEASE_FLOW_PROFILE || "basic_v1";
  if (profile === "basic_v1" || profile === "governed_v1") return profile;
  throw new Error("DEVPILOT_RELEASE_FLOW_PROFILE_INVALID");
}

/** Full policy is retained so advanced governance can be re-enabled without reconstructing it. */
const GOVERNED_CHECKPOINTS: Record<
  ReleaseGateCheckpoint,
  ReleaseGateCheckpointPolicy
> = {
  build_pre_execution: {
    stage: "build",
    phase: "commit",
    requiredGateIds: ["C01", "C02", "C03", "C05", "C06", "C08"],
  },
  build_post_execution: {
    stage: "build",
    phase: "commit",
    requiredGateIds: ["C07", "C09", "C10"],
  },
  staging_pre_execution: {
    stage: "staging",
    phase: "build",
    requiredGateIds: ["B01", "B02", "B03", "B06", "B09"],
  },
  production_pre_execution: {
    stage: "production",
    phase: "deploy",
    requiredGateIds: [
      "D01",
      "D02",
      "D03",
      "D05",
      "D06",
      "D07",
      "D08",
      "D09",
      "D10",
      "D11",
      "D12",
      "D13",
      "D14",
      "D15",
      "D16",
      "D17",
      "D18",
      "D19",
      "D20",
    ],
  },
  production_post_deploy: {
    stage: "production",
    phase: "promote",
    requiredGateIds: ["D17", "D18", "P01", "P02"],
  },
  production_promote: {
    stage: "production",
    phase: "promote",
    requiredGateIds: ["P03", "P04", "P05", "P06", "P07", "P08", "P10"],
  },
  production_promote_pre_route: {
    stage: "production",
    phase: "promote",
    requiredGateIds: ["P03", "P04", "P05", "P06", "P07", "P08", "P10"],
  },
  production_post_route: {
    stage: "production",
    phase: "promote",
    requiredGateIds: ["P09"],
  },
};

const BASIC_CHECKPOINTS: Record<
  ReleaseGateCheckpoint,
  ReleaseGateCheckpointPolicy
> = {
  ...GOVERNED_CHECKPOINTS,
  build_pre_execution: {
    ...GOVERNED_CHECKPOINTS.build_pre_execution,
    requiredGateIds: ["C01"],
  },
  build_post_execution: {
    ...GOVERNED_CHECKPOINTS.build_post_execution,
    requiredGateIds: [],
  },
  staging_pre_execution: {
    ...GOVERNED_CHECKPOINTS.staging_pre_execution,
    requiredGateIds: ["B02", "B09"],
  },
  production_pre_execution: {
    ...GOVERNED_CHECKPOINTS.production_pre_execution,
    requiredGateIds: ["D01", "D02", "D03"],
  },
  production_post_deploy: {
    ...GOVERNED_CHECKPOINTS.production_post_deploy,
    requiredGateIds: [],
  },
  production_promote: {
    ...GOVERNED_CHECKPOINTS.production_promote,
    requiredGateIds: [],
  },
  production_promote_pre_route: {
    ...GOVERNED_CHECKPOINTS.production_promote_pre_route,
    requiredGateIds: [],
  },
  production_post_route: {
    ...GOVERNED_CHECKPOINTS.production_post_route,
    requiredGateIds: [],
  },
};

export function releaseGateCheckpointPolicy(
  checkpoint: ReleaseGateCheckpoint,
  profile: ReleaseFlowProfile = ACTIVE_RELEASE_FLOW_PROFILE,
): ReleaseGateCheckpointPolicy {
  return profile === "basic_v1"
    ? BASIC_CHECKPOINTS[checkpoint]
    : GOVERNED_CHECKPOINTS[checkpoint];
}

export function defaultCheckpointForStage(
  stage: ReleaseGateDecisionStage,
): ReleaseGateCheckpoint {
  if (stage === "build") return "build_pre_execution";
  if (stage === "staging") return "staging_pre_execution";
  return "production_pre_execution";
}

export function productionApprovalRequired(
  profile: ReleaseFlowProfile = releaseFlowProfileFromEnvironment(),
) {
  return profile === "governed_v1";
}

export function productionPromotionRequired(
  profile: ReleaseFlowProfile = releaseFlowProfileFromEnvironment(),
) {
  return profile === "governed_v1";
}
