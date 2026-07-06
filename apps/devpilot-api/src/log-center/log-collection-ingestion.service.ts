import { Injectable } from "@nestjs/common";
import {
  LogRedactionPolicy,
  redactLogMessage,
  resolveLogRedactionPolicy,
} from "./log-redaction";
import { LogCollectionIngestionRepository } from "./log-collection-ingestion.repository";
import {
  CollectionLine,
  ParsedLogLine,
} from "./log-collection-ingestion.types";

@Injectable()
export class LogCollectionIngestionService {
  constructor(private readonly repository: LogCollectionIngestionRepository) {}

  async ingestCompletedRun(teamId: string, runId: string) {
    const run = await this.repository.findRun(teamId, runId);

    if (!run) return;
    if (run.ingestionStatus === "completed") return;

    if (run.status !== "completed") {
      await this.repository.markIngestion(
        run.id,
        "skipped",
        0,
        "采集运行未完成，跳过入库",
      );
      return;
    }

    if (run.dryRun) {
      await this.repository.markIngestion(
        run.id,
        "skipped",
        0,
        "dry-run 采集不写入日志条目",
      );
      return;
    }

    const extracted = this.extractLogLines(run.result, run.logs);
    if (extracted.length === 0) {
      await this.repository.markIngestion(
        run.id,
        "skipped",
        0,
        "采集结果中没有可写入的日志行",
      );
      return;
    }

    try {
      const redactionPolicy = resolveLogRedactionPolicy(run.stream?.metadata);
      const entries = extracted.map((line) =>
        this.parseLogLine(line, redactionPolicy),
      );
      await this.repository.createEntries(run, entries, redactionPolicy);
      const lastEntry = entries[entries.length - 1];
      await this.repository.updateStreamSnapshot(run, lastEntry);
      await this.repository.markIngestion(
        run.id,
        "completed",
        entries.length,
        null,
      );
    } catch (error) {
      await this.repository.markIngestion(
        run.id,
        "failed",
        0,
        error instanceof Error ? error.message : "日志采集结果入库失败",
      );
    }
  }

  private extractLogLines(
    resultValue: unknown,
    logsValue: unknown,
  ): CollectionLine[] {
    const result = this.asRecord(resultValue);
    const lines: CollectionLine[] = [];
    this.addTextLines(lines, this.readString(result.stdoutPreview), "stdout");
    this.addTextLines(lines, this.readString(result.stderrPreview), "stderr");

    if (lines.length === 0 && Array.isArray(logsValue)) {
      logsValue.forEach((item) => {
        const record = this.asRecord(item);
        const stream = this.readString(record.stream) || "executor";
        this.addTextLines(lines, this.readString(record.message), stream);
      });
    }

    return lines.slice(0, 1000);
  }

  private addTextLines(
    target: CollectionLine[],
    text: string | undefined,
    stream: string,
  ) {
    if (!text) return;
    text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line && line !== "...[truncated]")
      .forEach((line) => {
        target.push({ line, stream, lineNumber: target.length + 1 });
      });
  }

  private parseLogLine(
    line: CollectionLine,
    redactionPolicy: LogRedactionPolicy,
  ): ParsedLogLine {
    const timestamp = this.parseTimestamp(line.line);
    return {
      level: this.detectLevel(line.line),
      message: redactLogMessage(line.line, redactionPolicy),
      timestamp,
      stream: line.stream,
      lineNumber: line.lineNumber,
    };
  }

  private parseTimestamp(line: string) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}[T ][0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)/,
    );
    if (!match) return undefined;
    const normalized = match[1].includes("T")
      ? match[1]
      : match[1].replace(" ", "T");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private detectLevel(line: string) {
    const match = line.match(
      /\b(trace|debug|info|warn|warning|error|fatal|panic)\b/i,
    );
    if (!match) return "info";
    const value = match[1].toLowerCase();
    if (value === "warning") return "warn";
    if (value === "panic") return "fatal";
    return value;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : undefined;
  }
}
