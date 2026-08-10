import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ReleaseStagingRepository } from "./release-staging.repository";

type Manifest = NonNullable<
  Awaited<ReturnType<ReleaseStagingRepository["manifest"]>>
>;

export function requireDeployableStagingManifest(
  manifest: Manifest | null,
  scope: { teamId: string; projectId: string; releaseOrderId: string },
) {
  if (!manifest) {
    throw new NotFoundException("Manifest 不存在或不属于当前发布单");
  }
  if (
    manifest.buildRun.teamId !== scope.teamId ||
    manifest.buildRun.projectId !== scope.projectId ||
    manifest.buildRun.releaseOrderId !== scope.releaseOrderId
  ) {
    throw new NotFoundException("Manifest 关联 BuildRun 不属于当前发布单");
  }
  if (manifest.buildRun.status !== "succeeded") {
    throw new UnprocessableEntityException(
      "只有成功 BuildRun 的 Manifest 可以部署",
    );
  }
  const item = manifest.items.find(
    (candidate) => candidate.componentKey === "project-bundle",
  );
  if (!item || item.digest !== manifest.digest) {
    throw new UnprocessableEntityException("Manifest 缺少可验证的项目制品");
  }
  return { manifest, item };
}
