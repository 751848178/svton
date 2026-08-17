import { releaseBuildEnvSchema } from "./release-build-env.schema";

describe("release build environment schema", () => {
  it("accepts the external OCI launcher contract fields", () => {
    expect(releaseBuildEnvSchema.parse({
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: "external-oci-launcher-v1",
      RELEASE_BUILD_LAUNCHER_PROOF_FILE: "/run/devpilot/proof.json",
      RELEASE_BUILD_LAUNCHER_JOB_IMAGE: `registry.test/api@sha256:${"a".repeat(64)}`,
      RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE: "/usr/bin/docker",
      RELEASE_BUILD_SUPPLY_PROOF_FILE: "/opt/devpilot/supply.json",
    })).toEqual(expect.objectContaining({
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: "external-oci-launcher-v1",
    }));
  });

  it("rejects the retired same-container filesystem provider", () => {
    expect(() => releaseBuildEnvSchema.parse({
      RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: "filesystem-isolated-worker-v1",
    })).toThrow();
  });
});
