import { Injectable } from "@nestjs/common";
import { access, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { publishReleaseBuildEvidence, unavailableReleaseBuildEvidence } from "./release-build-evidence-publisher";
import type { ReleaseBuildGateEvidence } from "./release-build-evidence.types";
import {
  lockedInstallArgs,
  packageScriptArgs,
  resolveReleasePackageContext,
  type ReleasePackageContext,
} from "./release-build-package-policy";
import type { ReleaseBuildComponent } from "./release-build.types";
import { ReleaseEvidenceArtifactPort } from "./release-evidence-artifact.port";

@Injectable()
export class ReleaseBuildPackageEvidenceService {
  constructor(private readonly artifacts: ReleaseEvidenceArtifactPort) {}

  async execute(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
    sourceCommitSha: string;
    sourceSnapshotDigest: string;
    checkoutRoot: string;
    dependencyStoreRoot?: string;
    components: ReleaseBuildComponent[];
    profile: RegisteredReleaseBuildProfile;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    cancelGraceMs: number;
    signal?: AbortSignal;
  }) {
    const exactInput = { ...input, checkoutRoot: await realpath(input.checkoutRoot) };
    const contexts = await Promise.all(input.components.map(async (component) =>
      resolveReleasePackageContext({
        checkoutRoot: exactInput.checkoutRoot,
        componentRoot: await realpath(resolve(exactInput.checkoutRoot, component.workingDirectory)),
        profile: input.profile,
      }),
    ));
    if (contexts.some((context) => context === null)) return missingPackageEvidence();
    const exact = contexts as ReleasePackageContext[];
    const install = await this.runInstalls(exactInput, uniqueRoots(exact));
    const tests = await this.runScripts(exactInput, exact, "test", "tests");
    const lint = await this.runScripts(exactInput, exact, "lint", "lint");
    const types = await this.runScripts(exactInput, exact, "typecheck", "typecheck");
    return {
      install: combine(install, "install_failed"),
      tests: combine(tests, "tests_failed"),
      quality: combine([...lint, ...types], "quality_failed"),
      logs: [...install, ...tests, ...lint, ...types].flatMap((item) => item.logs),
    };
  }

  private runInstalls(input: EvidenceInput, contexts: ReleasePackageContext[]) {
    return Promise.all(contexts.map((context) =>
      this.run(input, context, "install", lockedInstallArgs(
        context.manager,
        input.dependencyStoreRoot,
      ), context.root),
    ));
  }

  private runScripts(
    input: EvidenceInput,
    contexts: ReleasePackageContext[],
    script: string,
    category: string,
  ) {
    return Promise.all(contexts.map((context) => {
      if (!context.scripts[script]) {
        return Promise.resolve(unavailableResult(`${script}_not_configured`));
      }
      return this.run(
        input,
        context,
        category,
        packageScriptArgs(context.manager, script),
        context.componentRoot,
      );
    }));
  }

  private async run(
    input: EvidenceInput,
    context: ReleasePackageContext,
    category: string,
    args: string[],
    cwd: string,
  ) {
    try { await access(context.executable, constants.X_OK); } catch {
      return unavailableResult(`${context.manager}_tool_missing`);
    }
    const outcome = await runReleaseBuildArgv({
      executable: context.executable,
      args,
      cwd,
      env: input.env,
      timeoutMs: input.timeoutMs,
      cancelGraceMs: input.cancelGraceMs,
      signal: input.signal,
    });
    const passed = outcome.kind === "completed" && outcome.exitCode === 0;
    const evidence = await publishReleaseBuildEvidence({
      ...input,
      artifacts: this.artifacts,
      category,
      toolId: context.manager,
      toolVersion: context.toolVersion,
      rulesDigest: `${category}-script-v1`,
      outcome,
      result: { passed, componentRoot: relativeRoot(input.checkoutRoot, cwd) },
      passed,
      reasonCode: passed ? `${category}_passed` : `${category}_failed`,
    });
    return { evidence, logs: [`[${category}] ${outcome.stdout}`, outcome.stderr] };
  }
}

type EvidenceInput = Parameters<ReleaseBuildPackageEvidenceService["execute"]>[0];
type EvidenceResult = { evidence: ReleaseBuildGateEvidence; logs: string[] };

function uniqueRoots(items: ReleasePackageContext[]) {
  return [...new Map(items.map((item) => [item.root, item])).values()];
}

function unavailableResult(reason: string): EvidenceResult {
  return { evidence: unavailableReleaseBuildEvidence(reason), logs: [] };
}

function missingPackageEvidence() {
  const missing = unavailableReleaseBuildEvidence("locked_package_context_missing");
  return { install: missing, tests: missing, quality: missing, logs: [] };
}

function combine(items: EvidenceResult[], reason: string): ReleaseBuildGateEvidence {
  const unavailable = items.find((item) => item.evidence.status === "unavailable");
  if (unavailable) return unavailable.evidence;
  const failed = items.find((item) => item.evidence.status === "failed");
  if (failed) return { ...failed.evidence, reasonCode: reason };
  return aggregate(items.map((item) => item.evidence));
}

function aggregate(items: ReleaseBuildGateEvidence[]): ReleaseBuildGateEvidence {
  return {
    status: "passed",
    reasonCode: "all_components_passed",
    evidenceRef: items.map((item) => item.evidenceRef).join(";"),
    evidenceHash: items.map((item) => item.evidenceHash).join(":"),
  };
}

function relativeRoot(root: string, cwd: string) {
  return cwd === root ? "." : cwd.slice(root.length + 1);
}
