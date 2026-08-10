import { resolveReleaseDeploymentTargetReadiness } from "./release-deployment-target-readiness.model";

describe("release deployment target readiness", () => {
  it("returns TARGET_MISSING for an environment without bindings", () => {
    expect(resolveReleaseDeploymentTargetReadiness([], "ssh-v1")).toMatchObject({
      reasonCode: "TARGET_MISSING",
      bindingCount: 0,
      currentTarget: null,
    });
  });

  it("returns PROVIDER_MISMATCH when bindings target another provider", () => {
    expect(
      resolveReleaseDeploymentTargetReadiness(
        [binding("one", "local-filesystem-v1", { targetRef: "/tmp/app" })],
        "ssh-v1",
      ),
    ).toMatchObject({ reasonCode: "PROVIDER_MISMATCH", bindingCount: 1 });
  });

  it("returns SSH_ROOT_INVALID for an unsafe SSH root", () => {
    expect(
      resolveReleaseDeploymentTargetReadiness(
        [binding("one", "ssh-v1", { root: "/" })],
        "ssh-v1",
      ),
    ).toMatchObject({ reasonCode: "SSH_ROOT_INVALID", currentTarget: null });
  });

  it("returns TARGET_DUPLICATED for two valid provider matches", () => {
    expect(
      resolveReleaseDeploymentTargetReadiness(
        [
          binding("one", "ssh-v1", { root: "/srv/one" }),
          binding("two", "ssh-v1", { root: "/srv/two" }),
        ],
        "ssh-v1",
      ),
    ).toMatchObject({ reasonCode: "TARGET_DUPLICATED", bindingCount: 2 });
  });
});

function binding(
  id: string,
  providerKey: string,
  deployment: Record<string, unknown>,
) {
  return {
    id,
    metadata: { releaseDeployment: { providerKey, ...deployment } },
    server: {
      id: `server-${id}`,
      host: "10.0.0.1",
      port: 22,
      username: "deploy",
    },
  };
}
