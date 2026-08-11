import { Injectable } from "@nestjs/common";
import { constants } from "node:fs";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { redactRepositoryValue } from "../repository-analysis/repository-analysis-redact.utils";
import type {
  RegisteredReleaseBuildProfile,
  ReleaseBuildScannerProfile,
} from "./release-build-acceptance-profile";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import {
  publishReleaseBuildEvidence,
  unavailableReleaseBuildEvidence,
} from "./release-build-evidence-publisher";
import type { ReleaseBuildGateEvidence } from "./release-build-evidence.types";
import { validateReleaseScannerReport } from "./release-build-scanner-report.policy";
import { ReleaseEvidenceArtifactPort } from "./release-evidence-artifact.port";

@Injectable()
export class ReleaseBuildScannerEvidenceService {
  constructor(private readonly artifacts: ReleaseEvidenceArtifactPort) {}

  async execute(input: ScannerExecutionInput) {
    const entries = await Promise.all(
      input.profile.scanners.map((scanner) => this.run(input, scanner)),
    );
    return Object.fromEntries(
      entries.map(([id, evidence]) => [id, evidence]),
    ) as Record<ReleaseBuildScannerProfile["id"], ReleaseBuildGateEvidence>;
  }

  private async run(
    input: ScannerExecutionInput,
    scanner: ReleaseBuildScannerProfile,
  ): Promise<[ReleaseBuildScannerProfile["id"], ReleaseBuildGateEvidence]> {
    try {
      await access(scanner.executable, constants.X_OK);
    } catch {
      return [
        scanner.id,
        unavailableReleaseBuildEvidence(`${scanner.id}_tool_missing`),
      ];
    }
    const reportPath = join(input.temporaryRoot, `${scanner.id}.json`);
    const args = scanner.argvTemplate.map((value) =>
      value
        .replaceAll("{checkoutRoot}", input.checkoutRoot)
        .replaceAll("{reportPath}", reportPath),
    );
    try {
      const outcome = await runReleaseBuildArgv({
        executable: scanner.executable,
        args,
        cwd: input.checkoutRoot,
        env: input.env,
        timeoutMs: input.timeoutMs,
        cancelGraceMs: input.cancelGraceMs,
        signal: input.signal,
      });
      const report = await readJson(reportPath);
      if (report === null) {
        return [
          scanner.id,
          unavailableReleaseBuildEvidence(`${scanner.id}_report_missing`),
        ];
      }
      const validated = validateReleaseScannerReport(scanner.id, report);
      if (!validated.valid) {
        return [
          scanner.id,
          unavailableReleaseBuildEvidence(validated.reasonCode),
        ];
      }
      const passed =
        outcome.kind === "completed" &&
        outcome.exitCode === 0 &&
        validated.findings === 0;
      return [
        scanner.id,
        await publishReleaseBuildEvidence({
          ...input,
          artifacts: this.artifacts,
          category: scanner.id,
          toolId: scanner.id,
          toolVersion: scanner.toolVersion,
          rulesDigest: scanner.rulesDigest,
          dataDigest: scanner.dataDigest,
          dataUpdatedAt: scanner.dataUpdatedAt,
          outcome,
          result: redactRepositoryValue(validated.report),
          passed,
          reasonCode: passed
            ? `${scanner.id}_passed`
            : `${scanner.id}_findings_or_execution_failed`,
        }),
      ];
    } finally {
      await rm(reportPath, { force: true });
    }
  }
}

export type ScannerExecutionInput = {
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  sourceCommitSha: string;
  checkoutRoot: string;
  temporaryRoot: string;
  profile: RegisteredReleaseBuildProfile;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  cancelGraceMs: number;
  signal?: AbortSignal;
};

async function readJson(path: string) {
  try {
    const content = await readFile(path, "utf8");
    if (Buffer.byteLength(content) > 10 * 1024 * 1024) return null;
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}
