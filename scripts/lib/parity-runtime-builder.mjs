import { spawnSync } from "node:child_process";

export function createOwnedBuildxBuilder(runtime, execute = runDocker) {
  requireBuilderName(runtime);
  if (findBuilder(runtime.builderName, execute)) {
    throw builderError("name-collision");
  }
  requireSuccess(
    execute([
      "buildx",
      "create",
      "--name",
      runtime.builderName,
      "--driver",
      "docker-container",
      "--driver-opt",
      "default-load=true",
      "--bootstrap",
    ]),
    "create",
  );
  return validateBuilder(findBuilder(runtime.builderName, execute), runtime);
}

export function destroyOwnedBuildxBuilder(runtime, execute = runDocker) {
  requireBuilderName(runtime);
  const builder = findBuilder(runtime.builderName, execute);
  if (!builder) return { status: "already_absent", name: runtime.builderName };
  validateBuilder(builder, runtime);
  requireSuccess(
    execute(["buildx", "rm", "--force", runtime.builderName]),
    "remove",
  );
  if (findBuilder(runtime.builderName, execute)) {
    throw builderError("remove-residual");
  }
  return { status: "removed", name: runtime.builderName };
}

export function assertNoOwnedBuildxBuilder(runtime, execute = runDocker) {
  requireBuilderName(runtime);
  if (findBuilder(runtime.builderName, execute)) {
    throw builderError("residual");
  }
  return { status: "verified_absent", name: runtime.builderName };
}

function findBuilder(name, execute) {
  const result = execute(["buildx", "ls", "--format", "{{json .}}"]);
  requireSuccess(result, "list");
  return lines(result.stdout)
    .map((line) => JSON.parse(line))
    .find((builder) => builder.Name === name);
}

function validateBuilder(builder, runtime) {
  if (
    !builder ||
    builder.Name !== runtime.builderName ||
    builder.Driver !== "docker-container" ||
    !Array.isArray(builder.Nodes) ||
    builder.Nodes.length !== 1 ||
    builder.Nodes[0]?.Name !== `${runtime.builderName}0`
  ) {
    throw builderError("identity-mismatch");
  }
  return Object.freeze({
    status: "verified",
    name: builder.Name,
    driver: builder.Driver,
    node: builder.Nodes[0].Name,
  });
}

function requireBuilderName(runtime) {
  if (runtime.builderName !== `devpilot-builder-${runtime.runtimeId}`) {
    throw builderError("runtime-name-mismatch");
  }
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
    throw builderError(`${operation}:${result.stderr || result.status}`);
  }
}

function builderError(reason) {
  return new Error(`PARITY_BUILDX_BUILDER_INVALID: ${reason}`);
}
