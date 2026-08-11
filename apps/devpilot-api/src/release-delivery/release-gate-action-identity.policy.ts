import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { ReleaseGateCheckpoint } from "./release-gate-decision.types";

export type ReleaseGateActionIdentity = {
  actionInputHash: string;
  requesterActorId: string;
};

export function releaseGateActionIdentity(input: {
  checkpoint: ReleaseGateCheckpoint;
  actionInput?: Record<string, string | null>;
  requesterActorId: string;
}): ReleaseGateActionIdentity {
  return {
    actionInputHash: stableHash({
      scope: "release-gate-action-v1",
      checkpoint: input.checkpoint,
      actionInput: input.actionInput ?? {},
    }),
    requesterActorId: input.requesterActorId,
  };
}
