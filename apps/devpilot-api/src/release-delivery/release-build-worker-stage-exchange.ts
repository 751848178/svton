import { join } from "node:path";
import type { ReleaseBuildGateEvidence } from "./release-build-evidence.types";
import type { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { readImmutableWorkerJson, workerJobDirectory,
  writeImmutableWorkerJson } from "./release-build-worker-exchange";
import type { ReleaseBuildWorkerIdentity,
  ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import { signWorkerDependencyAssignment, signWorkerScanReady,
  signWorkerDependencyStage,
  type ReleaseBuildWorkerDependencyAssignment,
  type ReleaseBuildWorkerDependencyStage,
  type ReleaseBuildWorkerScanReady } from "./release-build-worker-stage-envelope.policy";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";

export async function publishWorkerScanReady(input: {
  outputDirectory: string;
  secretFile: string;
  request: ReleaseBuildWorkerRequest;
  security: Record<string, ReleaseBuildGateEvidence>;
}) {
  const secret = await readReleaseBuildWorkerSecret(input.secretFile);
  await writeImmutableWorkerJson(input.outputDirectory, "scan-ready.json",
    signWorkerScanReady({ version: 1, identity: input.request.identity,
      security: input.security }, secret));
}

export async function readWorkerScanReady(runtime: ReleaseBuildRuntimeProfileService,
  identity: ReleaseBuildWorkerRequest["identity"]) {
  const directory = await workerJobDirectory(runtime.workerOutputRoot,
    identity.jobId, false, runtime.workerSharedGid);
  return readImmutableWorkerJson<ReleaseBuildWorkerScanReady>(
    join(directory, "scan-ready.json"));
}

export async function publishWorkerDependencyAssignment(input: {
  runtime: ReleaseBuildRuntimeProfileService;
  identity: ReleaseBuildWorkerIdentity;
  secret: string;
}) {
  const directory = await workerJobDirectory(input.runtime.workerInputRoot,
    input.identity.jobId, false, input.runtime.workerSharedGid);
  await writeImmutableWorkerJson(directory, "dependency-assignment.json",
    signWorkerDependencyAssignment({ version: 1, identity: input.identity },
      input.secret), input.runtime.workerSharedGid);
}

export async function waitForWorkerDependencyAssignment(input: {
  inputDirectory: string;
  request: ReleaseBuildWorkerRequest;
  signal: AbortSignal;
  pollMs?: number;
}) {
  while (Date.now() <= new Date(input.request.identity.deadline).getTime()) {
    if (input.signal.aborted) throw new Error("BUILD_COMMAND_CANCELED");
    try {
      return await readImmutableWorkerJson<ReleaseBuildWorkerDependencyAssignment>(
        join(input.inputDirectory, "dependency-assignment.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, input.pollMs ?? 50));
  }
  throw new Error("DEPENDENCY_ASSIGNMENT_TIMEOUT");
}

export async function publishWorkerDependencyStage(input: {
  directory: string;
  filename: "fetch-starting.json" | "fetch-authorized.json";
  identity: ReleaseBuildWorkerIdentity;
  stage: ReleaseBuildWorkerDependencyStage["stage"];
  secret: string;
  sharedGid?: number;
}) {
  await writeImmutableWorkerJson(input.directory, input.filename,
    signWorkerDependencyStage({ version: 1, identity: input.identity,
      stage: input.stage }, input.secret), input.sharedGid);
}

export async function readWorkerDependencyStage(input: {
  runtime: ReleaseBuildRuntimeProfileService;
  identity: ReleaseBuildWorkerIdentity;
  filename: "fetch-starting.json" | "fetch-authorized.json";
  direction: "input" | "output";
}) {
  const root = input.direction === "input"
    ? input.runtime.workerInputRoot : input.runtime.workerOutputRoot;
  const directory = await workerJobDirectory(root, input.identity.jobId,
    false, input.runtime.workerSharedGid);
  return readImmutableWorkerJson<ReleaseBuildWorkerDependencyStage>(
    join(directory, input.filename));
}

export async function waitForWorkerFetchAuthorization(input: {
  inputDirectory: string;
  identity: ReleaseBuildWorkerIdentity;
  signal: AbortSignal;
  pollMs?: number;
}) {
  while (Date.now() <= new Date(input.identity.deadline).getTime()) {
    if (input.signal.aborted) throw new Error("BUILD_COMMAND_CANCELED");
    try {
      return await readImmutableWorkerJson<ReleaseBuildWorkerDependencyStage>(
        join(input.inputDirectory, "fetch-authorized.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, input.pollMs ?? 50));
  }
  throw new Error("DEPENDENCY_FETCH_AUTHORIZATION_TIMEOUT");
}
