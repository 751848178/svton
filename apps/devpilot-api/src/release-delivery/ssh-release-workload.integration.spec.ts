import "reflect-metadata";
import { SshReleaseWorkloadIntegrationFixture } from "./ssh-release-workload.integration-fixture";

const describeIntegration =
  process.env.RUN_F433_SSH_WORKLOAD_INTEGRATION === "1"
    ? describe
    : describe.skip;

jest.setTimeout(60_000);

describeIntegration("F433 SSH exact-Manifest workloads", () => {
  const fixture = new SshReleaseWorkloadIntegrationFixture();

  beforeAll(() => fixture.start());
  afterAll(() => fixture.stop());

  it("starts exact workloads across both lifecycle modes and probes the current run", async () => {
    const { first, second, third } = await fixture.deployAcrossModes();
    expect(first.providerDeploymentId).not.toBe(second.providerDeploymentId);
    for (const receipt of [first, second, third]) {
      expect(receipt.evidence).toMatchObject({
        providerActivated: true,
        workloadReady: { status: "passed", serviceCount: 4 },
        healthProbe: { status: "passed", processChecks: 4, httpChecks: 3 },
        httpProbe: { status: "passed", checkedServices: 3 },
      });
      expect(JSON.stringify(receipt)).not.toContain("runtime-sentinel-f433");
    }
    const probe = await fixture.probe();
    expect(probe.exitCode).toBe(0);
    expect(probe.stdout).toContain("PROCESS_frontend=running");
    expect(probe.stdout).toContain("PROCESS_backend=running");
    expect(probe.stdout).toContain("PROCESS_static=running");
    expect(probe.stdout).toContain("PROCESS_worker=running");
    expect(probe.stdout).toContain("frontend-exact-manifest-f433");
    expect(probe.stdout).toContain("backend-exact-manifest-f433");
    expect(probe.stdout).toContain("static-exact-manifest-f433");
    expect(probe.stdout).toContain(
      '"providerDeploymentId":"deployment-f433-3"',
    );
    expect(probe.stdout).toContain("MODE_TRANSITIONS=clean");
    await expect(fixture.deployWithFailingHealth()).rejects.toMatchObject({
      detail: { code: "WORKLOAD_HEALTH_FAILED" },
    });
    const restored = await fixture.probe();
    expect(restored.exitCode).toBe(0);
    expect(restored.stdout).toContain("PROCESS_frontend=running");
    expect(restored.stdout).toContain(
      '"providerDeploymentId":"deployment-f433-3"',
    );
  });
});
