import { join } from "node:path";
import { controlledBuildEnvironment } from "./release-build-command-policy";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { signWorkerCancellation, type ReleaseBuildWorkerIdentity,
  type ReleaseBuildWorkerResult } from "./release-build-worker-envelope.policy";
import { readImmutableWorkerJson, workerJobDirectory,
  writeImmutableWorkerJson } from "./release-build-worker-exchange";

type WorkerRoots = {
  workerInputRoot: string; workerOutputRoot: string;
  workerSharedGid: number;
};

export function sourceEnvironment(path: string) {
  return controlledBuildEnvironment(path, "/nonexistent", "/tmp");
}
export function workerDelay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function isolatedWorkerFailure(code: string) {
  return releaseBuildExecutionFailure(code, "隔离 Build Worker 未返回可信结果", [],
    "检查 Worker 状态后重试。");
}
export async function readIsolatedWorkerResult(
  runtime: WorkerRoots, identity: ReleaseBuildWorkerIdentity,
) {
  const directory = await workerJobDirectory(runtime.workerOutputRoot,
    identity.jobId, false, runtime.workerSharedGid);
  return readImmutableWorkerJson<ReleaseBuildWorkerResult>(join(directory, "result.json"));
}
export async function publishIsolatedWorkerCancel(
  runtime: WorkerRoots, identity: ReleaseBuildWorkerIdentity, secret: string,
  reason: "canceled" | "timeout",
) {
  const directory = await workerJobDirectory(runtime.workerInputRoot,
    identity.jobId, false, runtime.workerSharedGid);
  await writeImmutableWorkerJson(directory, "cancel.json", signWorkerCancellation({
    version: 1, identity, reason, requestedAt: new Date().toISOString(),
  }, secret), runtime.workerSharedGid).catch(() => undefined);
}
