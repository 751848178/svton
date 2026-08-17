import { extname } from "node:path";
import type { ReleaseBuildSastCapability } from "./release-build-acceptance-profile";
import type { WorkerSourceManifestEntry } from "./release-build-worker-source-manifest";

export const SAST_UNSUPPORTED_SOURCE_REASON =
  "sast_capability_unsupported_source_extension" as const;

export function evaluateReleaseBuildSastCapability(
  capability: ReleaseBuildSastCapability,
  entries: readonly WorkerSourceManifestEntry[],
) {
  const unsupported = new Set(
    capability.unsupportedExtensions.map((value) => value.toLowerCase()),
  );
  const extensions = [...new Set(entries
    .map((entry) => extname(entry.path).toLowerCase())
    .filter((extension) => unsupported.has(extension)))].sort();
  return extensions.length === 0
    ? { available: true as const }
    : {
        available: false as const,
        reasonCode: SAST_UNSUPPORTED_SOURCE_REASON,
        engine: capability.engine,
        unsupportedExtensions: extensions,
      };
}
