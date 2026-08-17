import { resolveDockerEngineNetwork } from "./release-build-engine-network.policy";

describe("Docker engine dependency network policy", () => {
  it("accepts only the exact Docker Desktop engine proxy tuple", () => {
    expect(resolveDockerEngineNetwork(tuple("Docker Desktop", "linux",
      "http.docker.internal:3128", "http.docker.internal:3128")))
      .toMatchObject({ dependencyNetworkMode: "docker-desktop-engine-proxy-v1",
        engineEvidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it("accepts native Linux only without an engine proxy", () => {
    const direct = resolveDockerEngineNetwork(
      tuple("Ubuntu 24.04", "linux", "", ""));
    const desktop = resolveDockerEngineNetwork(tuple("Docker Desktop", "linux",
      "http.docker.internal:3128", "http.docker.internal:3128"));
    expect(direct).toMatchObject({ dependencyNetworkMode: "direct-public-dns-v1" });
    expect(direct.engineEvidenceDigest).not.toBe(desktop.engineEvidenceDigest);
  });

  it.each([
    tuple("Docker Desktop", "linux", "user:pass@http.docker.internal:3128", ""),
    tuple("Docker Desktop", "linux", "http.docker.internal:3128/path",
      "http.docker.internal:3128/path"),
    tuple("Ubuntu", "linux", "http://proxy:3128", "http://proxy:3128"),
    tuple("Docker Desktop", "windows", "", ""),
  ])("fails closed for unsupported or tampered engine tuple", (value) => {
    expect(() => resolveDockerEngineNetwork(value))
      .toThrow("dependency_network_unavailable");
  });
});

function tuple(os: string, type: string, http: string, https: string) {
  return [os, type, http, https].map((value) => JSON.stringify(value)).join("|");
}
