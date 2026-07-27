import { BadRequestException } from "@nestjs/common";
import {
  isRecord,
  readOptionalNumber,
  readOptionalString,
  readRequiredString,
} from "./server-executor-json.utils";
import type { ServerCommandStep } from "./server-executor.types";

export function readCommandStepsSnapshot(value: unknown): ServerCommandStep[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException("Server executor steps 快照无效");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new BadRequestException(
        `Server executor step ${index + 1} 快照无效`,
      );
    }

    return {
      key: readRequiredString(item.key, `steps.${index}.key`),
      label: readRequiredString(item.label, `steps.${index}.label`),
      command: readCommandStringSnapshot(
        item.command,
        `steps.${index}.command`,
      ),
      cwd: readOptionalString(item.cwd),
      required: typeof item.required === "boolean" ? item.required : true,
      risk: readOptionalEnum(item.risk, ["low", "medium", "high"]),
      timeoutSeconds: readOptionalNumber(item.timeoutSeconds),
      preview: readOptionalString(item.preview),
      phase: readOptionalEnum(item.phase, [
        "checkout",
        "build",
        "environment",
        "pre_start_check",
        "migration",
        "initialization",
        "deploy",
        "health_check",
        "cleanup",
      ]),
      runPolicy: readOptionalEnum(item.runPolicy, [
        "every_deploy",
        "once_per_environment_command",
      ]),
      failurePolicy: readOptionalEnum(item.failurePolicy, [
        "block",
        "best_effort",
      ]),
      decision: readOptionalEnum(item.decision, ["execute", "skip"]),
      skipReason: readOptionalString(item.skipReason),
    };
  });
}

function readOptionalEnum<T extends string>(
  value: unknown,
  choices: readonly T[],
): T | undefined {
  return typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : undefined;
}

function readCommandStringSnapshot(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new BadRequestException(`Server executor 快照缺少 ${field}`);
  }
  return value;
}
