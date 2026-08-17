import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { ProductionReleasePreview } from "./release-production.types";

export function recoveryProductionPreview(
  preview: ProductionReleasePreview,
  deploymentProviderKey: string,
) {
  return {
    ...preview,
    deploymentProviderKey,
    inputHash: stableHash({
      scope: "production-recovery",
      productionInputHash: preview.inputHash,
      deploymentProviderKey,
    }),
  };
}
