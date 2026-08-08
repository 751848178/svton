import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const HISTORY_EVIDENCE =
  "/tmp/codex-tool-runs/svton/f456/f456-version-history-evidence.json";

export async function loadNegativeHistoryContext(path = HISTORY_EVIDENCE) {
  const bytes = await readFile(path);
  const document = JSON.parse(bytes.toString("utf8"));
  const base = document.steps?.["base-state-rows"]?.result;
  const build2 = document.steps?.["build-2"]?.result;
  const firstManifest = base?.manifests?.[0];
  const crossOrder = base?.productionVersions?.find(
    (item) =>
      item.artifactManifestId && item.artifactManifestId !== firstManifest?.id,
  );
  return {
    sourcePath: path,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    status: document.status,
    projectId: document.fixedIds?.projectId,
    orderId: document.fixedIds?.orderId,
    manifestM1: firstManifest?.id,
    manifestM1Digest: firstManifest?.digest,
    manifestM2: build2?.manifestId,
    manifestM2Digest: build2?.manifestDigest,
    crossOrderManifestId: crossOrder?.artifactManifestId,
    historyAcceptanceIds: Object.keys(document.ac ?? {}).sort(),
    historyAcceptancePassed: Object.values(document.ac ?? {}).every(
      (item) => item.ok === true,
    ),
  };
}
