import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type {
  ProductionReleasePreview,
  ProductionReleaseSnapshot,
} from "./release-production.types";

export function productionPreview(context: any): ProductionReleasePreview {
  if (!context.order) {
    throw new NotFoundException("发布单不存在或不属于当前项目");
  }
  if (!context.manifest) {
    throw new NotFoundException("Manifest 不存在或不属于当前发布单");
  }
  if (context.productionEnvironments.length !== 1) {
    throw new UnprocessableEntityException(
      "项目必须有且仅有一个活动 Production 基线",
    );
  }
  const environment = context.productionEnvironments[0];
  if (!environment.currentConfigRevision) {
    throw new UnprocessableEntityException("Production 尚无可冻结的配置修订");
  }
  const manifest = context.manifest;
  if (manifest.buildRun.status !== "succeeded") {
    throw new UnprocessableEntityException(
      "Production 只能使用成功 BuildRun 的 Manifest",
    );
  }
  const bundle = manifest.items.find(
    (item: any) => item.componentKey === "project-bundle",
  );
  if (!bundle || bundle.digest !== manifest.digest) {
    throw new UnprocessableEntityException(
      "Manifest Digest 未知或与项目制品不一致",
    );
  }
  const proof = context.stagingProof;
  const result = objectValue(proof?.result);
  if (
    !proof ||
    result.artifactVerified !== true ||
    result.manifestId !== manifest.id ||
    result.manifestDigest !== manifest.digest
  ) {
    throw new UnprocessableEntityException(
      "同一 Manifest 尚无成功 Staging 技术部署证明",
    );
  }
  const revision = environment.currentConfigRevision;
  const snapshot: ProductionReleaseSnapshot = {
    version: 1,
    projectId: context.order.projectId,
    releaseOrder: {
      id: context.order.id,
      releaseVersion: context.order.releaseVersion,
    },
    environment: {
      id: environment.id,
      key: environment.key,
      name: environment.name,
      baselineRole: "production",
    },
    build: {
      id: manifest.buildRun.id,
      revision: manifest.buildRun.revision,
      sourceBranch: manifest.buildRun.sourceBranch,
      sourceCommitSha: manifest.buildRun.sourceCommitSha,
    },
    manifest: { id: manifest.id, digest: manifest.digest },
    stagingProof: {
      deploymentRunId: proof.id,
      environmentId: proof.environmentId,
      finishedAt: proof.finishedAt.toISOString(),
    },
    config: {
      revisionId: revision.id,
      revision: revision.revision,
      snapshotHash: revision.snapshotHash,
      resourceSnapshot: revision.resourceReferences ?? [],
      routeSnapshot: revision.routeSnapshot ?? {},
      policySnapshot: revision.policyReferences ?? [],
    },
  };
  return {
    snapshot,
    inputHash: stableHash({ scope: "production-release", snapshot }),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
