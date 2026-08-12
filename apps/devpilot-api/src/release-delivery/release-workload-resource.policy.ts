import { UnprocessableEntityException } from "@nestjs/common";

export type ReleaseWorkloadResourceRequirement = {
  cpuMillicores: number;
  memoryBytes: number;
  diskBytes: number;
};

export function releaseWorkloadResourceRequirement(
  value: unknown,
): ReleaseWorkloadResourceRequirement | undefined {
  const input = record(value);
  const cpuMillicores = positiveInteger(input.cpuMillicores);
  const memoryBytes = positiveInteger(input.memoryBytes);
  const diskBytes = positiveInteger(input.diskBytes);
  if (!cpuMillicores && !memoryBytes && !diskBytes) return undefined;
  if (!cpuMillicores || !memoryBytes || !diskBytes) {
    throw new UnprocessableEntityException(
      "resourceRequirements 必须完整声明 CPU、内存与磁盘需求",
    );
  }
  return { cpuMillicores, memoryBytes, diskBytes };
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
