import type { ConfigService } from "@nestjs/config";
import { isAbsolute, relative, resolve } from "node:path";
import { EXTERNAL_OCI_LAUNCHER, verifyLauncherProof } from "./release-build-launcher-proof.policy";

export function resolveReleaseBuildWorkerRuntime(
  config: ConfigService,
  trustedTestFixture: boolean,
) {
  const provider =
    config.get<string>("RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER") || "disabled";
  const input = config.get<string>("RELEASE_BUILD_WORKER_INPUT_ROOT");
  const output = config.get<string>("RELEASE_BUILD_WORKER_OUTPUT_ROOT");
  const secret = config.get<string>("RELEASE_BUILD_WORKER_HMAC_SECRET_FILE");
  const workerProcess = boolean(config.get("RELEASE_BUILD_WORKER_PROCESS"));
  const proofFile = config.get<string>("RELEASE_BUILD_LAUNCHER_PROOF_FILE");
  const jobImage = config.get<string>("RELEASE_BUILD_LAUNCHER_JOB_IMAGE");
  const inputRoot = resolve(input || ".");
  const outputRoot = resolve(output || ".");
  const secretFile = resolve(secret || ".");
  const launcherChild = workerProcess &&
    boolean(config.get("RELEASE_BUILD_LAUNCHER_CHILD"));
  const external = provider === EXTERNAL_OCI_LAUNCHER;
  const apiPathsConfigured = external && Boolean(input && output && secret) &&
    isAbsolute(input || "") && isAbsolute(output || "") &&
    isAbsolute(secret || "") && !overlaps(inputRoot, outputRoot);
  return {
    inputRoot,
    outputRoot,
    secretFile,
    pollIntervalMs: positive(config.get("RELEASE_BUILD_WORKER_POLL_INTERVAL_MS"), 250),
    sharedGid: positive(config.get("RELEASE_BUILD_WORKER_SHARED_GID"), 2000),
    external,
    jobImage,
    get ready() {
      return trustedTestFixture || launcherChild ||
        (apiPathsConfigured && verifyLauncherProof({
          proofFile, secretFile: secret, jobImage,
        }));
    },
  };
}

function positive(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function boolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}
function overlaps(left: string, right: string) {
  const path = relative(left, right);
  const reverse = relative(right, left);
  return path === "" || reverse === "" ||
    (!path.startsWith("..") && !isAbsolute(path)) ||
    (!reverse.startsWith("..") && !isAbsolute(reverse));
}
