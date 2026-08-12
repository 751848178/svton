import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("F454 isolated parity compose stack", () => {
  const root = resolve(__dirname, "../../../..");

  it("is a namespaced self-contained project with isolated ports/volumes", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
    expect(source).toContain(
      "name: ${PARITY_COMPOSE_PROJECT:-devpilot-parity}",
    );
    for (const expected of [
      "devpilot-parity-mysql",
      "devpilot-parity-redis",
      "devpilot-parity-release-build",
      "devpilot-parity-deployments",
      "parity-target-workload",
      "route-control:",
      '"127.0.0.1:${PARITY_API_PORT:-4132}:4132"',
      '"127.0.0.1:${PARITY_WEB_PORT:-4131}:3120"',
      '"127.0.0.1:${PARITY_MYSQL_PORT:-4334}:3306"',
      '"127.0.0.1:${PARITY_REDIS_PORT:-4384}:6379"',
      '"127.0.0.1:${PARITY_SSH_PORT:-4222}:2222"',
      '"127.0.0.1:${PARITY_TARGET_PORT:-43992}:80"',
      '"127.0.0.1:${PARITY_ROUTE_CONTROL_PORT:-43993}:${PARITY_ROUTE_CONTROL_PORT:-43993}"',
      "MYSQL_DATABASE: ${PARITY_DATABASE_NAME:-devpilot_parity}",
      "org.opencontainers.image.revision:",
      "io.svton.devpilot.source-tree-sha256:",
      "/read-only-repositories/parity-app-intake:ro",
    ]) {
      expect(source).toContain(expected);
    }
    expect(source).not.toContain("container_name:");
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
      '"127.0.0.1:${PARITY_API_PORT:-4132}:4132"',
      '"127.0.0.1:${PARITY_WEB_PORT:-4131}:3120"',
      '"127.0.0.1:${PARITY_MYSQL_PORT:-4334}:3306"',
      '"127.0.0.1:${PARITY_REDIS_PORT:-4384}:6379"',
      '"127.0.0.1:${PARITY_SSH_PORT:-4222}:2222"',
      '"127.0.0.1:${PARITY_TARGET_PORT:-43992}:80"',
      '"127.0.0.1:${PARITY_ROUTE_CONTROL_PORT:-43993}:${PARITY_ROUTE_CONTROL_PORT:-43993}"',
    ]) {
      expect(source).toContain(port);
    }
    expect(source).not.toMatch(
      /127\.0\.0\.1:(3121|3334|2225|23992|3120|3320|6384):/,
    );
  });

  it("enables the controlled-local executor and local-filesystem provider inside the parity project only", async () => {
    const source = await readFile(
      resolve(root, "docker-compose.devpilot-parity.yml"),
      "utf8",
    );
    for (const expected of [
      'RELEASE_BUILD_EXECUTION_ENABLED: "true"',
      "RELEASE_BUILD_EXECUTOR_PROFILE: controlled-local-acceptance-v2",
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
      "SITE_ROUTE_SWITCH_PROVIDER_PROFILE: http-route-control-v1",
      "SITE_ROUTE_SWITCH_HTTP_ENDPOINT: http://route-control:${PARITY_ROUTE_CONTROL_PORT:-43993}",
      "SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE: ${PARITY_LOCAL_ACCEPTANCE_PROFILE:-}",
      "SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME: ${PARITY_LOCAL_ACCEPTANCE_HOSTNAME:-}",
      "PARITY_REQUIRE_VERIFIED_RUNTIME: ${PARITY_REQUIRE_VERIFIED_RUNTIME:-0}",
      "- parity.example.test",
      "dockerfile: scripts/parity-route-control.Dockerfile",
      "dockerfile: scripts/parity-deploy-target.Dockerfile",
      "dockerfile: scripts/parity-target-workload.Dockerfile",
      "image: ${PARITY_ROUTE_CONTROL_IMAGE:-devpilot-parity-route-control:local}",
      "devpilot-parity-route-control:/var/lib/route-control",
      "ROUTE_CONTROL_STATE_FILE: /var/lib/route-control/state.json",
      "image: ${PARITY_DEPLOY_TARGET_IMAGE:-devpilot-parity-deploy-target:local}",
      "image: ${PARITY_TARGET_WORKLOAD_IMAGE:-devpilot-parity-target-workload:local}",
      'command: ["node", "/app/parity-route-control-provider.mjs"]',
      "REPOSITORY_ANALYSIS_LOCAL_ROOTS: /read-only-repositories",
      "devpilot-parity-release-build:/var/lib/devpilot/release-build",
      "devpilot-parity-deployments:/var/lib/devpilot/release-build/deployments",
      'PASSWORD_ACCESS: "true"',
      "USER_PASSWORD: devpilot-test",
    ]) {
      expect(source).toContain(expected);
    }
    const routeDockerfile = await readFile(
      resolve(root, "scripts/parity-route-control.Dockerfile"),
      "utf8",
    );
    expect(routeDockerfile).toContain(
      "COPY scripts/lib/parity-route-control-domain.mjs /app/lib/parity-route-control-domain.mjs",
    );
    expect(routeDockerfile).toContain(
      "COPY scripts/lib/parity-route-control-state-store.mjs /app/lib/parity-route-control-state-store.mjs",
    );
    // The parity deploy target must NOT mount the host docker socket.
    expect(source).not.toContain("docker.sock");
    expect(source).not.toContain(
      "parity-route-control-provider.mjs:/app/scripts/parity-route-control-provider.mjs:ro",
    );
    expect(source).not.toContain(
      "deploy-target-parity-init.sh:/custom-cont-init.d",
    );
    expect(source).not.toContain(
      "./fixtures/parity-target-site:/usr/share/nginx/html",
    );
    expect(source).toContain(
      "mysql@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb",
    );
    expect(source).toContain(
      "redis@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2",
    );
    expect(source).not.toMatch(
      /image: (mysql:8\.4|redis:7-alpine|lscr\.io\/linuxserver\/openssh-server:latest|nginx:alpine)/,
    );
    await expect(
      readFile(
        resolve(root, "scripts/parity-deploy-target.Dockerfile"),
        "utf8",
      ),
    ).resolves.toContain(
      "lscr.io/linuxserver/openssh-server@sha256:96b9a4d3b5106746d08d43a6911650d4d21f7d5c7f2ac9660e792bdb5e63157c",
    );
    await expect(
      readFile(
        resolve(root, "scripts/parity-deploy-target.Dockerfile"),
        "utf8",
      ),
    ).resolves.toContain(
      "COPY --chmod=755 scripts/deploy-target-parity-init.sh /custom-cont-init.d/99-install-tools.sh",
    );
    await expect(
      readFile(
        resolve(root, "scripts/parity-target-workload.Dockerfile"),
        "utf8",
      ),
    ).resolves.toContain(
      "nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752",
    );
  });
});
