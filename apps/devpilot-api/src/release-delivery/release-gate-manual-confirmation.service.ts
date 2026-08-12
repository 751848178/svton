import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { GateEvaluationRepository } from "./gate-evaluation.repository";

@Injectable()
export class ReleaseGateManualConfirmationService {
  constructor(private readonly evaluations: GateEvaluationRepository) {}

  async resolve(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    evaluationId: string;
    gateId: string;
  }) {
    const row = await this.evaluations.manualConfirmationTarget(input);
    if (!row || row.gateId !== input.gateId) {
      throw new NotFoundException("门禁结论不存在或与请求门禁不匹配");
    }
    const definition = manualDefinition(row.gateId);
    if (definition.phase === "deploy" || definition.phase === "promote") {
      const summary = record(row.summary);
      const identity = record(summary.decisionIdentity);
      const evidence = record(summary.evidenceIdentity);
      if (
        !row.releaseRunId ||
        (definition.phase === "promote" && (
          typeof identity.deploymentRunId !== "string" ||
          typeof identity.candidateHash !== "string" ||
          !/^[a-f0-9]{64}$/.test(identity.candidateHash) ||
          evidence.releaseRunId !== row.releaseRunId ||
          evidence.deploymentRunId !== identity.deploymentRunId ||
          evidence.candidateHash !== identity.candidateHash
        ))
      ) {
        throw new UnprocessableEntityException(
          "Production 人工门禁缺少精确 DeploymentRun 或候选哈希",
        );
      }
      return { permission: "production" as const };
    }
    const identity = record(record(row.summary).decisionIdentity);
    const preBuild = definition.phase === "commit" &&
      identity.checkpoint === "build_pre_execution" &&
      typeof identity.approvalSubjectHash === "string" &&
      typeof identity.actionInputHash === "string" &&
      typeof identity.requesterActorId === "string";
    if (!row.buildRunId && !preBuild) {
      throw new UnprocessableEntityException(
        "Build 人工门禁缺少精确 BuildRun 或 build_pre 动作身份",
      );
    }
    return { permission: "build" as const };
  }

  confirm(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    evaluationId: string;
    actorId: string;
    reason: string;
    gateId: string;
  }) {
    manualDefinition(input.gateId);
    return this.evaluations.confirmManual(input);
  }
}

function manualDefinition(gateId: string) {
  const definition = RELEASE_GATE_DEFINITIONS.find(
    (candidate) => candidate.id === gateId,
  );
  if (!definition?.dispositions.includes("manual")) {
    throw new UnprocessableEntityException("该门禁未定义人工确认处置");
  }
  return definition;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
