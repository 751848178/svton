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

  it("keeps build execution disabled and staging deployment explicitly enabled", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-app.yml"),
      "utf8",
    );
    // 构建执行仍 fail-closed（需 v13 external-OCI-launcher 设施）；
    // 预发部署 2026-08-22 起按用户要求显式启用（local-filesystem-v1），
    // 保证既有发布单 预发→生产 审批链可执行。此测试仍钉死两值，防漂移。
    expect(source).toContain('RELEASE_BUILD_EXECUTION_ENABLED: "false"');
    expect(source).toContain("RELEASE_BUILD_EXECUTOR_PROFILE: disabled");
    expect(source).toContain('RELEASE_STAGING_DEPLOYMENT_ENABLED: "true"');
    expect(source).toContain("RELEASE_DEPLOYMENT_PROVIDER_PROFILE: local-filesystem-v1");
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
      "RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: external-oci-launcher-v1",
      "RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: /run/secrets/release-build-worker-hmac",
      "RELEASE_BUILD_LAUNCHER_PROOF_FILE: /run/launcher/release-build-proof.json",
      "RELEASE_BUILD_LAUNCHER_JOB_IMAGE: ${RELEASE_BUILD_LAUNCHER_JOB_IMAGE:?set an immutable repo@sha256 job image}",
      "RELEASE_BUILD_SUPPLY_PROOF_FILE: /opt/devpilot/security/release-build-supply-proof.json",
      'RELEASE_BUILD_RUN_TIMEOUT_MS: "180000"',
      'RELEASE_BUILD_COMMAND_TIMEOUT_MS: "120000"',
      'RELEASE_BUILD_CANCEL_GRACE_MS: "5000"',
      'RELEASE_BUILD_MAX_CONCURRENCY: "2"',
      'RELEASE_STAGING_DEPLOYMENT_ENABLED: "true"',
      "RELEASE_DEPLOYMENT_PROVIDER_PROFILE: local-filesystem-v1",
      "RELEASE_STAGING_DEPLOYMENT_ROOT: /var/lib/devpilot/release-build/deployments",
      'RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: "120000"',
      "${RELEASE_BUILD_WORKER_INPUT_ROOT_HOST:?set host launcher input root}",
      "${RELEASE_BUILD_WORKER_OUTPUT_ROOT_HOST:?set host launcher output root}",
      "${RELEASE_BUILD_LAUNCHER_PROOF_ROOT_HOST:?set host launcher proof root}",
      "read_only: true",
      'cap_drop: ["ALL"]',
      'security_opt: ["no-new-privileges:true"]',
      "pids_limit: 256",
      "/tmp:rw,nosuid,size=64m",
      "file: ${RELEASE_BUILD_WORKER_HMAC_SECRET_FILE:?set a 32-byte secret file}",
      "dockerfile: apps/devpilot-api/Dockerfile",
    ]) {
      expect(source).toContain(expected);
    }
    expect(source).not.toContain("/var/run/docker.sock");
    expect(source).not.toContain("release-build-worker:");
    const launcher = await readFile(resolve(root,
      "scripts/devpilot/run-release-build-external-oci-launcher.sh"), "utf8");
    expect(launcher).not.toMatch(/\binstall\s+-d\b/);
    expect(launcher).toContain("pre-provisioned directory missing");
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
