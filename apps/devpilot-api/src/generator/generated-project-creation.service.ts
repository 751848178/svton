import { ConflictException, Injectable } from "@nestjs/common";
import { GeneratedProjectDraftService } from "../project/generated-project-draft.service";
import { ProjectGovernanceFinalizationService } from "../project/project-governance-finalization.service";
import type { GenerateProjectRequestDto } from "./dto/generate.dto";
import { GeneratedProjectArtifactMaterializationService } from "./generated-project-artifact-materialization.service";
import type { ProjectZipArtifact } from "./generator.service";

export interface GeneratedProjectCreationResult {
  projectId: string;
  zipBuffer: Buffer;
  artifact: ProjectZipArtifact;
}

@Injectable()
export class GeneratedProjectCreationService {
  constructor(
    private readonly drafts: GeneratedProjectDraftService,
    private readonly governance: ProjectGovernanceFinalizationService,
    private readonly artifacts: GeneratedProjectArtifactMaterializationService,
  ) {}

  async create(
    teamId: string,
    actorId: string,
    dto: GenerateProjectRequestDto,
  ): Promise<GeneratedProjectCreationResult> {
    const draft = await this.drafts.prepare({
      teamId,
      actorId,
      name: dto.basicInfo.name,
      description: dto.basicInfo.description,
      config: dto,
      idempotencyKey: dto.idempotencyKey,
    });
    if (draft.onboardingStatus === "ready") {
      return this.artifacts.readAttached(teamId, draft);
    }
    if (draft.onboardingRevision === null) {
      throw new ConflictException({
        code: "GENERATED_PROJECT_DRAFT_REVISION_MISSING",
        message: "生成项目草稿缺少治理修订号",
        remediation: "请重新创建生成项目。",
      });
    }

    const result = await this.artifacts.materialize({ teamId, actorId, draft, dto });
    await this.finalizeGovernance(
      teamId,
      actorId,
      draft.id,
      draft.onboardingRevision,
      draft.idempotencyKey,
      result.artifact.sha256,
    );
    return result;
  }

  private finalizeGovernance(
    teamId: string,
    actorId: string,
    projectId: string,
    revision: number,
    idempotencyKey: string,
    artifactSha256: string,
  ) {
    return this.governance.finalize({
      teamId,
      projectId,
      actorId,
      expectedStatus: "draft",
      expectedRevision: revision,
      allowAlreadyReady: true,
      auditAction: "project.generate.finalize",
      auditSummary: "生成项目已完成，Staging/Production 基线已锁定",
      auditMetadata: {
        artifactSha256,
        idempotencyKey,
      },
    });
  }

}
