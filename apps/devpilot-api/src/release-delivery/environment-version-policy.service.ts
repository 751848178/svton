import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { EnvironmentVersionRepository } from "./environment-version.repository";

interface SelectionInput {
  teamId: string;
  projectId: string;
  environmentId: string;
  kind: "upgrade" | "recovery";
  manifestId?: string;
  sourceVersionId?: string;
}

@Injectable()
export class EnvironmentVersionPolicyService {
  constructor(private readonly repository: EnvironmentVersionRepository) {}

  async resolveSelection(
    input: SelectionInput,
    currentVersionId: string | null,
  ) {
    if (input.kind === "upgrade") {
      if (!input.manifestId || input.sourceVersionId) {
        throw new UnprocessableEntityException(
          "升级必须且只能选择一个已有 Manifest",
        );
      }
      return { manifestId: input.manifestId, sourceVersionId: undefined };
    }
    if (!input.sourceVersionId || input.manifestId) {
      throw new UnprocessableEntityException(
        "回退必须且只能选择一个环境历史版本",
      );
    }
    if (input.sourceVersionId === currentVersionId) {
      throw new UnprocessableEntityException("回退目标不能是当前环境版本");
    }
    const source = await this.repository.sourceVersion(
      input.teamId,
      input.projectId,
      input.environmentId,
      input.sourceVersionId,
    );
    if (!source) throw new NotFoundException("回退版本不存在或不属于当前环境");
    return {
      manifestId: source.artifactManifestId,
      sourceVersionId: source.id,
    };
  }

  async validateProduction(
    input: { releaseRunId?: string; teamId: string; projectId: string },
    environment: {
      id: string;
      baselineRole: string | null;
      currentConfigRevisionId: string | null;
    },
    manifest: {
      id: string;
      digest: string;
      deploymentRuns: Array<{ result: unknown }>;
    },
  ) {
    if (environment.baselineRole !== "production") return undefined;
    if (!hasVerifiedStagingProof(manifest)) {
      throw new UnprocessableEntityException(
        "Production 目标缺少同一 Manifest 的 Staging 成功证明",
      );
    }
    if (!input.releaseRunId) {
      throw new UnprocessableEntityException(
        "Production 执行必须绑定已批准的 ReleaseRun",
      );
    }
    const run = await this.repository.releaseRun(
      input.teamId,
      input.projectId,
      environment.id,
      input.releaseRunId,
    );
    const approval = run?.operationApproval;
    if (
      !run ||
      run.status !== "awaiting_approval" ||
      run.artifactManifestId !== manifest.id ||
      run.verifiedDigest !== manifest.digest ||
      run.configRevisionId !== environment.currentConfigRevisionId ||
      !approval ||
      approval.status !== "approved" ||
      approval.consumedAt ||
      approval.inputHash !== run.inputHash
    ) {
      throw new UnprocessableEntityException(
        "Production ReleaseRun 未批准、已使用或输入已漂移",
      );
    }
    return run.id;
  }
}

function hasVerifiedStagingProof(manifest: {
  id: string;
  digest: string;
  deploymentRuns: Array<{ result: unknown }>;
}) {
  return manifest.deploymentRuns.some(({ result }) => {
    const value =
      result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : {};
    return (
      value.artifactVerified === true &&
      value.manifestId === manifest.id &&
      value.manifestDigest === manifest.digest
    );
  });
}
