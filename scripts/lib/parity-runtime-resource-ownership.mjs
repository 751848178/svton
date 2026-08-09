import { spawnSync } from "node:child_process";
import {
  assertRuntimeImageLabels,
  expectedRuntimeImageLabels,
} from "./parity-runtime-provenance.mjs";
import {
  collectRuntimeImages,
  resolveRuntimeImageId,
} from "./parity-runtime-image-identity.mjs";

const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
const OWNER_LABEL = "io.svton.devpilot.cleanup-owner-token";

export function assertOwnedRuntimeResources(
  runtime,
  execute = runDocker,
  expectedImageIds,
) {
  const inventory = collectRuntimeResourceInventory(
    runtime,
    execute,
    expectedImageIds,
  );
  const expected = expectedRuntimeImageLabels(runtime);
  for (const [kind, resources] of Object.entries(inventory)) {
    for (const resource of resources) {
      assertRuntimeImageLabels(resource.labels, expected);
      if (
        kind !== "images" &&
        resource.labels[COMPOSE_PROJECT_LABEL] !== runtime.composeProject
      ) {
        throw ownershipError(`${kind}-compose-project-mismatch`);
      }
    }
  }
  return inventory;
}

export function assertRunningRuntimeProvenance(
  runtime,
  expectedImageIds,
  execute = runDocker,
) {
  const inventory = assertOwnedRuntimeResources(
    runtime,
    execute,
    expectedImageIds,
  );
  const services = Object.fromEntries(
    inventory.containers.map((container) => [
      container.labels["com.docker.compose.service"],
      container,
    ]),
  );
  for (const service of [
    "mysql",
    "redis",
    "api",
    "web",
    "route-control",
    "deploy-target",
    "target-workload",
  ]) {
    if (!services[service]) throw ownershipError(`missing-service:${service}`);
  }
  for (const [service, image] of Object.entries({
    api: runtime.apiImage,
    web: runtime.webImage,
    "route-control": runtime.routeControlImage,
  })) {
    const currentImageId = resolveRuntimeImageId(image, execute);
    if (
      currentImageId !== expectedImageIds[service] ||
      services[service].imageId !== expectedImageIds[service]
    ) {
      throw ownershipError(`${service}-running-image-mismatch`);
    }
  }
  return { inventory, services };
}

export function assertNoRuntimeResources(
  runtime,
  execute = runDocker,
  expectedImageIds,
) {
  const inventory = collectRuntimeResourceInventory(
    runtime,
    execute,
    expectedImageIds,
  );
  const residuals = Object.entries(inventory).flatMap(([kind, resources]) =>
    resources.map((resource) => `${kind}:${resource.id}`),
  );
  if (residuals.length > 0) {
    throw ownershipError(`residuals:${residuals.join(",")}`);
  }
  return inventory;
}

export function assertNoComposeResources(runtime, execute = runDocker) {
  const inventory = collectRuntimeResourceInventory(runtime, execute);
  const residuals = ["containers", "networks", "volumes"].flatMap((kind) =>
    inventory[kind].map((resource) => `${kind}:${resource.id}`),
  );
  if (residuals.length > 0) {
    throw ownershipError(`compose-residuals:${residuals.join(",")}`);
  }
  return inventory;
}

export function removeOwnedRuntimeImages(
  runtime,
  execute = runDocker,
  expectedImageIds,
) {
  const inventory = assertOwnedRuntimeResources(
    runtime,
    execute,
    expectedImageIds,
  );
  if (inventory.images.length === 0) return inventory;
  for (const image of inventory.images) {
    requireSuccess(execute(["image", "rm", image.id]), "image-remove");
  }
  return inventory;
}

export function collectRuntimeResourceInventory(
  runtime,
  execute = runDocker,
  expectedImageIds,
) {
  const projectFilter = `label=${COMPOSE_PROJECT_LABEL}=${runtime.composeProject}`;
  return {
    containers: collect(
      "container",
      ["-a", "--filter", projectFilter],
      execute,
    ),
    networks: collect("network", ["--filter", projectFilter], execute),
    volumes: collect("volume", ["--filter", projectFilter], execute),
    images: collectRuntimeImages(runtime, execute, expectedImageIds),
  };
}

function collect(kind, args, execute) {
  const format = kind === "volume" ? "--format={{.Name}}" : "--format={{.ID}}";
  const listed = execute([kind, "ls", ...args, format]);
  requireSuccess(listed, `${kind}-list`);
  return inspectMany(kind, lines(listed.stdout), execute);
}

function inspectMany(kind, ids, execute) {
  return ids.map((id) => {
    const result = execute([kind, "inspect", id]);
    requireSuccess(result, `${kind}-inspect`);
    const record = JSON.parse(result.stdout)[0];
    const labels =
      kind === "image"
        ? record?.Config?.Labels
        : (record?.Labels ?? record?.Config?.Labels);
    return {
      id: record?.Id || record?.Name || id,
      labels: labels || {},
      ...(kind === "container" ? { imageId: record?.Image } : {}),
    };
  });
}

function runDocker(args) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

function lines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function requireSuccess(result, operation) {
  if (result.status !== 0) {
    throw ownershipError(`${operation}:${result.stderr || result.status}`);
  }
}

function ownershipError(reason) {
  return new Error(`PARITY_RUNTIME_OWNERSHIP_INVALID: ${reason}`);
}
