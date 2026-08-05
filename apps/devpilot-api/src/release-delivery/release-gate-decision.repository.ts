import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import { GATE_DEFINITION_VERSION } from "./gate-evaluation-persistence.utils";
import type {
  ReleaseGateDecision,
  ReleaseGateDecisionDraft,
} from "./release-gate-decision.types";

type DecisionScope = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  actorId: string;
};
type Client = Prisma.TransactionClient;

@Injectable()
export class ReleaseGateDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persist(
    scope: DecisionScope,
    draft: ReleaseGateDecisionDraft,
    requestKey?: string,
  ) {
    const inputHash = stableHash({
      definitionVersion: GATE_DEFINITION_VERSION,
      decision: draft,
    });
    const data = {
      ...scope,
      stage: draft.stage,
      phase: draft.phase,
      allowed: draft.allowed,
      definitionVersion: GATE_DEFINITION_VERSION,
      inputHash,
      requestKey,
      inputSnapshot: draft.snapshot as unknown as Prisma.InputJsonValue,
      blockerGateIds: draft.blockerGateIds,
      manualGateIds: draft.manualGateIds,
      confirmedManualGateIds: draft.confirmedManualGateIds,
      warningGateIds: draft.warningGateIds,
      deferredGateIds: draft.deferredGateIds,
      evidenceOnlyGateIds: draft.evidenceOnlyGateIds,
      integrityErrors: draft.integrityErrors,
    };
    const row = requestKey
      ? await this.prisma.releaseGateDecision.upsert({
          where: {
            releaseOrderId_stage_requestKey: {
              releaseOrderId: scope.releaseOrderId,
              stage: draft.stage,
              requestKey,
            },
          },
          create: data,
          update: {},
        })
      : await this.prisma.releaseGateDecision.create({ data });
    if (row.inputHash !== inputHash) {
      throw new ConflictException("同一门禁请求键已绑定不同输入，请刷新后重试");
    }
    if (row.actorId !== scope.actorId) {
      throw new ConflictException(
        "同一门禁请求键已绑定其他执行人，请使用新的动作请求",
      );
    }
    return presentDecision(row, draft);
  }

  async claim(
    tx: Client,
    input: DecisionScope & {
      decisionId: string;
      stage: string;
      inputHash: string;
      actionRunType: string;
      actionRunId: string;
      requireAllowed: boolean;
    },
  ) {
    return claimReleaseGateDecision(tx, input);
  }
}

export async function claimReleaseGateDecision(
  tx: Client,
  input: DecisionScope & {
    decisionId: string;
    stage: string;
    inputHash: string;
    actionRunType: string;
    actionRunId: string;
    requireAllowed: boolean;
  },
) {
  const claimed = await tx.releaseGateDecision.updateMany({
    where: {
      id: input.decisionId,
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      actorId: input.actorId,
      stage: input.stage,
      inputHash: input.inputHash,
      consumedAt: null,
      ...(input.requireAllowed ? { allowed: true } : {}),
    },
    data: {
      actionRunType: input.actionRunType,
      actionRunId: input.actionRunId,
      consumedAt: new Date(),
    },
  });
  if (claimed.count !== 1) {
    throw new ConflictException("门禁决定已消费、漂移或不属于当前动作");
  }
}

function presentDecision(
  row: {
    id: string;
    actorId: string | null;
    inputHash: string;
    createdAt: Date;
  },
  draft: ReleaseGateDecisionDraft,
): ReleaseGateDecision {
  const { snapshot, ...decision } = draft;
  void snapshot;
  return {
    ...decision,
    id: row.id,
    inputHash: row.inputHash,
    decidedAt: row.createdAt.toISOString(),
  };
}
