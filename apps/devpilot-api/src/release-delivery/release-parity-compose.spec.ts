import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("F454 isolated parity compose stack", () => {
  const root = resolve(__dirname, "../../../..");

  it("is a namespaced self-contained project with isolated ports/volumes", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
    expect(source).toContain("name: devpilot-parity");
    for (const expected of [
      "devpilot-parity-mysql",
      "devpilot-parity-redis",
      "devpilot-parity-release-build",
      "devpilot-parity-deployments",
      "parity-mysql",
      "parity-redis",
      "parity-api",
      "parity-web",
      "parity-deploy-target",
      "parity-target-workload",
      '"127.0.0.1:4132:4132"',
      '"127.0.0.1:4131:3120"',
      '"127.0.0.1:4334:3306"',
      '"127.0.0.1:4384:6379"',
      '"127.0.0.1:4222:2222"',
      '"127.0.0.1:43992:80"',
      "MYSQL_DATABASE: devpilot_parity",
    ]) {
      expect(source).toContain(expected);
    }
  });

  it("has no devpilot-g003 references and no shared external network", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
    expect(source).not.toMatch(/g003|devpilot_resource_pool/);
    expect(source).not.toContain("external:");
    // Host-facing parity ports only — no manual-stack published ports
    // (3121/3334/2225/23992 etc. are never published by the parity stack).
    for (const port of [
      '"127.0.0.1:4132:4132"',
      '"127.0.0.1:4131:3120"',
      '"127.0.0.1:4334:3306"',
      '"127.0.0.1:4384:6379"',
      '"127.0.0.1:4222:2222"',
      '"127.0.0.1:43992:80"',
    ]) {
      expect(source).toContain(port);
    }
    expect(source).not.toMatch(/127\.0\.0\.1:(3121|3334|2225|23992|3120|3320|6384):/);
  });

  it("enables the controlled-local executor and local-filesystem provider inside the parity project only", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
    for (const expected of [
      'RELEASE_BUILD_EXECUTION_ENABLED: "true"',
      "RELEASE_BUILD_EXECUTOR_PROFILE: controlled-local-v1",
      "RELEASE_BUILD_WORK_ROOT: /var/lib/devpilot/release-build/work",
      "RELEASE_BUILD_ARTIFACT_ROOT: /var/lib/devpilot/release-build/artifacts",
      'RELEASE_BUILD_RUN_TIMEOUT_MS: "180000"',
      'RELEASE_BUILD_COMMAND_TIMEOUT_MS: "120000"',
      'RELEASE_BUILD_MAX_CONCURRENCY: "2"',
      "RELEASE_BUILD_COMMAND_PATH: /pnpm:/usr/local/bin:/usr/bin:/bin",
      'RELEASE_STAGING_DEPLOYMENT_ENABLED: "true"',
      "RELEASE_DEPLOYMENT_PROVIDER_PROFILE: local-filesystem-v1",
      "RELEASE_STAGING_DEPLOYMENT_ROOT: /var/lib/devpilot/release-build/deployments",
      'RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: "120000"',
      "REPOSITORY_ANALYSIS_LOCAL_ROOTS: /read-only-repositories",
      "devpilot-parity-release-build:/var/lib/devpilot/release-build",
      "devpilot-parity-deployments:/var/lib/devpilot/release-build/deployments",
      "PASSWORD_ACCESS: \"true\"",
      "USER_PASSWORD: devpilot-test",
      "/custom-cont-init.d/99-install-tools.sh:ro",
    ]) {
      expect(source).toContain(expected);
    }
    // The parity deploy target must NOT mount the host docker socket.
    expect(source).not.toContain("docker.sock");
  });
});
