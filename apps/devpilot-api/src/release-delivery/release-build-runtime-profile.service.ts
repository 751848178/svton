import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAbsolute, relative, resolve } from "node:path";
import type { ReleaseBuildRuntimeDescriptor } from "./release-build.types";
import {
  resolveRegisteredReleaseBuildProfile,
  type RegisteredReleaseBuildProfile,
} from "./release-build-acceptance-profile";

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

  constructor(config: ConfigService) {
    this.profile =
      config.get<string>("RELEASE_BUILD_EXECUTOR_PROFILE") || "disabled";
    this.registeredProfile = resolveRegisteredReleaseBuildProfile(this.profile);
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

  assertAvailable() {
    if (!this.available) {
      throw new UnprocessableEntityException({
        code: "BUILD_EXECUTOR_DISABLED",
        message: "受控构建执行器未启用或运行目录配置无效",
        action: "仅在隔离验收 profile 中配置独立工作目录和制品目录后重试。",
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
    };
  }
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
