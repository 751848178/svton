import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { RepositoryGitInspectionService } from "../repository-analysis/repository-git-inspection.service";
import type { RepositoryCredentialMaterial } from "../repository-analysis/repository-analysis.types";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import type { ReleaseBuildSourceEvidence } from "./release-build-source-evidence.types";
import { ReleaseEvidenceArtifactPort } from "./release-evidence-artifact.port";
import { SourcePolicyRevisionRepository } from "./source-policy-revision.repository";

@Injectable()
export class ReleaseBuildSourceEvidenceService {
  constructor(
    private readonly git: RepositoryGitInspectionService,
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly artifacts: ReleaseEvidenceArtifactPort,
    private readonly policies: SourcePolicyRevisionRepository,
  ) {}

  async inspect(input: {
    projectId: string;
    teamId: string;
    releaseOrderId: string;
    repositoryUrl: string;
    branch: string;
    exactCommit: string;
    baselineCommit: string | null;
    credential: RepositoryCredentialMaterial;
    signal?: AbortSignal;
  }): Promise<ReleaseBuildSourceEvidence> {
    const profile = this.runtime.registeredProfile;
    if (!profile) return unavailable("source_profile_not_registered");
    if (!input.baselineCommit) return unavailable("source_baseline_missing");
    try {
      const report = await this.git.inspect({
        repositoryUrl: input.repositoryUrl,
        branch: input.branch,
        exactCommit: input.exactCommit,
        baselineCommit: input.baselineCommit,
        credential: input.credential,
        signal: input.signal,
      });
      const policy = await this.policies.resolveRegistered(
        input.teamId,
        input.projectId,
        profile,
      );
      const commitAuthorUserId = await this.policies.resolveCommitAuthorUserId(
        input.teamId,
        report.commitAuthorEmail,
      );
      if (!commitAuthorUserId) return unavailable("commit_author_subject_unmapped");
      const highRiskPaths = report.changedPaths.filter((path) =>
        profile.highRiskPathPrefixes.some((prefix) => path.startsWith(prefix)),
      );
      const checkedAt = new Date().toISOString();
      const sourcePolicyRevision = {
        id: policy.id,
        profileId: policy.profileId,
        profileVersion: policy.profileVersion,
        externalRequiredChecks: policy.externalRequiredChecks,
        requiredIndependentApprovals: policy.requiredIndependentApprovals,
        snapshotHash: policy.snapshotHash,
      };
      const fullReport = {
        version: 1,
        profileId: profile.id,
        profileVersion: profile.profileVersion,
        checkedAt,
        ...report,
        highRiskPaths,
        commitAuthorUserId,
        sourcePolicyRevision,
      };
      const artifact = await this.artifacts.publish({
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        buildRunId: `source-${input.exactCommit.slice(0, 16)}`,
        category: "source-state",
        report: fullReport,
      });
      const blocked =
        report.defaultHead !== report.exactCommit ||
        report.behind > 0 ||
        !report.mergeTreeClean;
      return {
        status: blocked ? "blocked" : "passed",
        reasonCode: blocked ? "source_merge_state_blocked" : "source_state_verified",
        checkedAt,
        evidenceRef: artifact.evidenceRef,
        evidenceHash: hash({ ...fullReport, reportDigest: artifact.reportDigest }),
        ...report,
        highRiskPaths,
        commitAuthorUserId,
        sourcePolicyRevision,
      };
    } catch {
      return unavailable("source_inspection_failed");
    }
  }
}

function unavailable(reasonCode: string): ReleaseBuildSourceEvidence {
  return {
    status: "unavailable",
    reasonCode,
    checkedAt: null,
    evidenceRef: null,
    evidenceHash: null,
  };
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
