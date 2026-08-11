import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("F426 V13 compose profile", () => {
  const root = resolve(__dirname, "../../../..");
  const nodeDigest =
    "sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5";
  const debianDigest =
    "sha256:abd67ffcfa541b485a3dff59865ab629aa048a6c613e639d36e7456b0b229241";

  it("pins runtime bases to registry-verified multiarch indexes", async () => {
    const [api, web] = await Promise.all([
      readFile(resolve(root, "apps/devpilot-api/Dockerfile"), "utf8"),
      readFile(resolve(root, "apps/devpilot-web/Dockerfile"), "utf8"),
    ]);
    expect(api).toContain(`FROM node:20@${nodeDigest} AS base`);
    expect(web).toContain(`FROM node:20@${nodeDigest} AS base`);
    expect(api).toContain(
      `FROM debian:bookworm-slim@${debianDigest} AS acceptance-tools`,
    );
    expect(`${api}\n${web}`).not.toMatch(
      /^FROM (node:20|debian:bookworm-slim) AS/m,
    );
  });

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
      "RELEASE_BUILD_ARTIFACT_ROOT: /exchange/output/artifacts",
      "RELEASE_BUILD_EVIDENCE_ROOT: /exchange/input/api-evidence",
      "RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: filesystem-isolated-worker-v1",
      "RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: /run/secrets/release-build-worker-hmac",
      'RELEASE_BUILD_RUN_TIMEOUT_MS: "180000"',
      'RELEASE_BUILD_COMMAND_TIMEOUT_MS: "120000"',
      'RELEASE_BUILD_CANCEL_GRACE_MS: "5000"',
      'RELEASE_BUILD_MAX_CONCURRENCY: "2"',
      'RELEASE_STAGING_DEPLOYMENT_ENABLED: "true"',
      "RELEASE_DEPLOYMENT_PROVIDER_PROFILE: local-filesystem-v1",
      "RELEASE_STAGING_DEPLOYMENT_ROOT: /var/lib/devpilot/release-build/deployments",
      'RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: "120000"',
      "devpilot-v13-worker-input:/exchange/input:rw",
      "devpilot-v13-worker-output:/exchange/output:ro",
      "release-build-worker:",
      'user: "2000:2000"',
      'network_mode: "none"',
      "read_only: true",
      'cap_drop: ["ALL"]',
      'security_opt: ["no-new-privileges:true"]',
      "pids_limit: 128",
      "/tmp:rw,nosuid,nodev,size=64m",
      "devpilot-v13-worker-input:/exchange/input:ro",
      "devpilot-v13-worker-output:/exchange/output:rw",
      "file: ${RELEASE_BUILD_WORKER_HMAC_SECRET_FILE:?set a 32-byte secret file}",
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
