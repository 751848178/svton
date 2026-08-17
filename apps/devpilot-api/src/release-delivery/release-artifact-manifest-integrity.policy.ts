import { UnprocessableEntityException } from "@nestjs/common";

const SHA256 = /^sha256:[a-f0-9]{64}$/i;

export function assertReleaseArtifactManifestIntegrity(input: {
  manifest: { id: string; digest: string; items: Array<{
    componentKey: string; artifactType?: string; digest: string;
  }> };
  stagingParams: unknown;
}) {
  const { manifest } = input;
  const bundle = manifest.items.filter((item) =>
    item.componentKey === "project-bundle");
  if (!SHA256.test(manifest.digest) || bundle.length !== 1 ||
    bundle[0].digest !== manifest.digest ||
    manifest.items.some((item) => !SHA256.test(item.digest))) invalid();
  const params = record(input.stagingParams);
  const workload = record(params.workload);
  if (params.manifestId !== manifest.id ||
    params.manifestDigest !== manifest.digest) invalid();
  const staged = componentDigests(workload.services);
  const current = manifest.items
    .filter((item) => item.componentKey !== "project-bundle")
    .map((item) => [item.componentKey, item.digest] as const)
    .sort(byComponent);
  if (!staged || staged.length !== current.length ||
    staged.some((item, index) => item[0] !== current[index][0] ||
      item[1] !== current[index][1])) invalid();
}

function componentDigests(value: unknown) {
  if (!Array.isArray(value)) return null;
  const entries: Array<readonly [string, string]> = [];
  for (const raw of value) {
    const service = record(raw);
    if (typeof service.componentKey !== "string" ||
      typeof service.artifactDigest !== "string" ||
      !SHA256.test(service.artifactDigest)) return null;
    entries.push([service.componentKey, service.artifactDigest]);
  }
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;
  return entries.sort(byComponent);
}

function byComponent(left: readonly [string, string], right: readonly [string, string]) {
  return left[0].localeCompare(right[0]);
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function invalid(): never {
  throw new UnprocessableEntityException(
    "Manifest Digest 未知、已漂移或与 Staging 验证制品不一致",
  );
}
