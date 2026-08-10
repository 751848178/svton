import { UnprocessableEntityException } from "@nestjs/common";
import type { EnvironmentVersionRepository } from "./environment-version.repository";

type Manifest = NonNullable<
  Awaited<ReturnType<EnvironmentVersionRepository["manifest"]>>
>;

export function verifiedEnvironmentVersionBundle(manifest: Manifest) {
  const bundle = manifest.items.find(
    (item) => item.componentKey === "project-bundle",
  );
  if (
    manifest.buildRun.status !== "succeeded" ||
    !bundle ||
    bundle.digest !== manifest.digest
  ) {
    throw new UnprocessableEntityException(
      "只能部署成功且 Digest 可验证的项目制品",
    );
  }
  return bundle;
}
