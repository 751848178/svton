import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAbsolute, relative, resolve } from "node:path";
import type { ReleaseBuildRuntimeDescriptor } from "./release-build.types";
import {
  resolveRegisteredReleaseBuildProfile,
  type RegisteredReleaseBuildProfile,
} from "./release-build-acceptance-profile";
import { resolveReleaseBuildWorkerRuntime } from "./release-build-worker-runtime-config";
import { verifyReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
const CHILD_ENVIRONMENT_KEYS = [
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "PATH",
  "TMPDIR",
] as const;
@Injectable()
export class ReleaseBuildRuntimeProfileService {
  readonly profile: string;
  readonly workRoot: string;
  readonly artifactRoot: string;
  readonly runTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly cancelGraceMs: number;
  readonly maxConcurrency: number;
  readonly commandPath: string;
  private readonly executionEnabled: boolean;
  private readonly configuredWorkRoot: string | undefined;
  private readonly configuredArtifactRoot: string | undefined;
  readonly registeredProfile: RegisteredReleaseBuildProfile | null;
  private readonly trustedTestFixture: boolean;
  private readonly worker: ReturnType<typeof resolveReleaseBuildWorkerRuntime>;
  private readonly supplyProofVerified: boolean;
  constructor(config: ConfigService) {
    this.profile =
      config.get<string>("RELEASE_BUILD_EXECUTOR_PROFILE") || "disabled";
    this.registeredProfile = resolveRegisteredReleaseBuildProfile(this.profile);
    this.trustedTestFixture =
      config.get("NODE_ENV") === "test" &&
      boolean(config.get("RELEASE_BUILD_TRUSTED_TEST_FIXTURE"));
    this.worker = resolveReleaseBuildWorkerRuntime(config, this.trustedTestFixture);
    this.supplyProofVerified = this.trustedTestFixture ||
      verifyReleaseBuildSupplyProof(
        config.get<string>("RELEASE_BUILD_SUPPLY_PROOF_FILE"),
        this.registeredProfile,
      );
    this.executionEnabled = boolean(
      config.get("RELEASE_BUILD_EXECUTION_ENABLED"),
    );
    this.configuredWorkRoot = config.get<string>("RELEASE_BUILD_WORK_ROOT");
    this.configuredArtifactRoot = config.get<string>(
      "RELEASE_BUILD_ARTIFACT_ROOT",
    );
    this.workRoot = resolve(this.configuredWorkRoot || ".");
    this.artifactRoot = resolve(this.configuredArtifactRoot || ".");
    this.runTimeoutMs = number(config, "RELEASE_BUILD_RUN_TIMEOUT_MS", 900_000);
    this.commandTimeoutMs = number(
      config,
      "RELEASE_BUILD_COMMAND_TIMEOUT_MS",
      600_000,
    );
    this.cancelGraceMs = number(config, "RELEASE_BUILD_CANCEL_GRACE_MS", 5_000);
    this.maxConcurrency = number(config, "RELEASE_BUILD_MAX_CONCURRENCY", 1);
    this.commandPath =
      config.get<string>("RELEASE_BUILD_COMMAND_PATH") ||
      "/usr/local/bin:/usr/bin:/bin";
  }
  get available() {
    return (
      this.executionEnabled &&
      Boolean(this.registeredProfile) &&
      Boolean(this.configuredWorkRoot) &&
      Boolean(this.configuredArtifactRoot) &&
      this.worker.ready &&
      this.supplyProofVerified &&
      isAbsolute(this.configuredWorkRoot || "") &&
      isAbsolute(this.configuredArtifactRoot || "") &&
      !overlaps(this.workRoot, this.artifactRoot) &&
      !overlaps(this.workRoot, process.cwd()) &&
      !overlaps(this.artifactRoot, process.cwd())
    );
  }
  get activationRequested() {
    return this.executionEnabled || this.profile !== "disabled";
  }
  dependencyNetworkEvidence() {
    if (this.trustedTestFixture) return {
      dependencyNetworkMode: "direct-public-dns-v1" as const,
      engineEvidenceDigest: stableHash({ scope: "trusted-test-fixture-network" }),
    };
    const proof = this.worker.launcherProof;
    if (!proof) throw new UnprocessableEntityException({
      code: "BUILD_DEPENDENCY_NETWORK_UNAVAILABLE",
      message: "Build 依赖网络引擎证明不可用",
    });
    return { dependencyNetworkMode: proof.dependencyNetworkMode,
      engineEvidenceDigest: proof.engineEvidenceDigest };
  }
  get unavailableReason() {
    if (this.registeredProfile && !this.worker.ready) {
      return "untrusted_worker_provider_missing";
    }
    if (this.registeredProfile && !this.supplyProofVerified) {
      return "build_worker_supply_digest_unverified";
    }
    return "build_executor_disabled_or_invalid";
  }
  assertAvailable() {
    if (!this.available) {
      throw new UnprocessableEntityException({
        code: this.unavailableReason.toUpperCase(),
        message: unavailableMessage(this.unavailableReason),
        action: "安装实现 release-build-untrusted-worker-v1 的独立 Worker Provider。",
      });
    }
  }
  descriptor(): ReleaseBuildRuntimeDescriptor {
    const registered = this.registeredProfile;
    if (!registered) {
      return {
        profile: "controlled-local-v1",
        runTimeoutMs: this.runTimeoutMs,
        commandTimeoutMs: this.commandTimeoutMs,
        cancelGraceMs: this.cancelGraceMs,
        maxConcurrency: this.maxConcurrency,
        concurrencyScope: "single-process",
        workspacePolicy: "dedicated-build-root",
        environmentKeys: CHILD_ENVIRONMENT_KEYS,
        workerIsolation: workerIsolation(false),
      };
    }
    return {
      profile: registered.id,
      profileVersion: registered.profileVersion,
      runnerVersion: registered.runnerVersion,
      scannerRules: registered.scanners.map(({ id, toolVersion, rulesDigest }) => ({
        id,
        toolVersion,
        rulesDigest,
      })),
      runTimeoutMs: this.runTimeoutMs,
      commandTimeoutMs: this.commandTimeoutMs,
      cancelGraceMs: this.cancelGraceMs,
      maxConcurrency: this.maxConcurrency,
      concurrencyScope: "single-process",
      workspacePolicy: "dedicated-build-root",
      environmentKeys: CHILD_ENVIRONMENT_KEYS,
      workerIsolation: workerIsolation(
        this.trustedTestFixture,
        this.worker.external,
      ),
    };
  }
  get workerInputRoot() { return this.worker.inputRoot; }
  get workerOutputRoot() { return this.worker.outputRoot; }
  get workerSecretFile() { return this.worker.secretFile; }
  get workerPollIntervalMs() { return this.worker.pollIntervalMs; }
  get workerSharedGid() { return this.worker.sharedGid; }
  get workerJobImage() { return this.worker.jobImage; }
}

function unavailableMessage(reason: string) {
  if (reason === "untrusted_worker_provider_missing")
    return "缺少可证明隔离的非可信源码 Build Worker Provider";
  if (reason === "build_worker_supply_digest_unverified")
    return "Build Worker 供应链摘要证明缺失或与服务端注册档案不一致";
  return "受控构建执行器未启用或运行目录配置无效";
}

function workerIsolation(testFixture: boolean, external = false) {
  return {
    contractVersion: "release-build-untrusted-worker-v1" as const,
    provider: external
      ? "external-oci-launcher-v1" as const
      : testFixture ? "test-fixture-only" as const : "missing" as const,
    untrustedRepositories: external,
  };
}

function number(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function boolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function overlaps(left: string, right: string) {
  return contains(left, right) || contains(right, left);
}

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}
