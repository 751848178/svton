const mockSpawn = jest.fn();
jest.mock("node:child_process", () => ({ spawn: mockSpawn }));

import { runDependencyFetchOci } from "./release-dependency-fetch-oci-runner";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";

describe("dependency fetch OCI lifecycle", () => {
  it("does not create paths or spawn Docker when already canceled", async () => {
    const image = `registry.test/api@sha256:${"7".repeat(64)}`;
    await expect(runDependencyFetchOci({ identity: identity(image),
      lockfile: Buffer.from("lockfileVersion: '6.0'\n"), cacheRoot: "/missing/cache",
      jobRoot: "/missing/job", image, dockerExecutable: "/usr/bin/docker",
      launcherLabel: "launcher_instance_01", timeoutMs: 1_000,
      signal: AbortSignal.abort() })).rejects.toThrow("invalid");
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});

function identity(image: string): DependencyFetchIdentity {
  return { fetchRunId: `dep_${"1".repeat(64)}`,
    combinationHash: "1".repeat(64), lockfileDigest: "2".repeat(64),
    profileId: "controlled-local-acceptance-v2", profileVersion: 6,
    profileSnapshotHash: "3".repeat(64), supplyChainDigest: "4".repeat(64),
    fetchImage: image, jobImage: image, pnpmVersion: "8.12.0",
    platformOs: "linux", platformArch: "arm64",
    platformAbi: "node20-modules-115", platformLibc: "glibc-debian-bookworm",
    registryPolicyDigest: "5".repeat(64) };
}
