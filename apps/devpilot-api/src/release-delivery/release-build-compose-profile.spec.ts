import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("F426 V13 compose profile", () => {
  const root = resolve(__dirname, "../../../..");

  it("keeps the base API explicitly disabled", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-app.yml"),
      "utf8",
    );
    expect(source).toContain('RELEASE_BUILD_EXECUTION_ENABLED: "false"');
    expect(source).toContain("RELEASE_BUILD_EXECUTOR_PROFILE: disabled");
    expect(source).toContain('RELEASE_STAGING_DEPLOYMENT_ENABLED: "false"');
    expect(source).toContain("RELEASE_DEPLOYMENT_PROVIDER_PROFILE: disabled");
  });

  it("requires the explicit acceptance profile and controlled volume", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-v13-acceptance.yml"),
      "utf8",
    );
    for (const expected of [
      'profiles: ["v13-acceptance"]',
      'RELEASE_BUILD_EXECUTION_ENABLED: "true"',
      "RELEASE_BUILD_EXECUTOR_PROFILE: controlled-local-acceptance-v2",
      "RELEASE_BUILD_WORK_ROOT: /var/lib/devpilot/release-build/work",
      "RELEASE_BUILD_ARTIFACT_ROOT: /var/lib/devpilot/release-build/artifacts",
      'RELEASE_BUILD_RUN_TIMEOUT_MS: "180000"',
      'RELEASE_BUILD_COMMAND_TIMEOUT_MS: "120000"',
      'RELEASE_BUILD_CANCEL_GRACE_MS: "5000"',
      'RELEASE_BUILD_MAX_CONCURRENCY: "2"',
      'RELEASE_STAGING_DEPLOYMENT_ENABLED: "true"',
      "RELEASE_DEPLOYMENT_PROVIDER_PROFILE: local-filesystem-v1",
      "RELEASE_STAGING_DEPLOYMENT_ROOT: /var/lib/devpilot/release-build/deployments",
      'RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: "120000"',
      "devpilot-v13-release-build:/var/lib/devpilot/release-build",
      "read_only: true",
      'cap_drop: ["ALL"]',
      'security_opt: ["no-new-privileges:true"]',
      "pids_limit: 256",
      "/tmp:rw,nosuid,size=64m",
      "not an untrusted-code sandbox",
    ]) {
      expect(source).toContain(expected);
    }
  });

  it("keeps the F431 password SSH fixture isolated from source and build tools", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.deploy-target.yml"),
      "utf8",
    );
    const target = source.slice(source.indexOf("  deploy-target-password:"));
    expect(target).toContain('PASSWORD_ACCESS: "true"');
    expect(target).toContain("devpilot-deploy-target-password-data:/config");
    expect(target).not.toMatch(
      /docker\.sock|picshare|deploy-target-init|source checkout/,
    );
  });
});
