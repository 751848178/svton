import { BadRequestException } from "@nestjs/common";

export const OBSERVABILITY_PROVIDER_REFS = {
  local_acceptance_v1: {
    logs: "local-runtime-logs-v1",
    metrics: "local-health-probe-v1",
    traces: "not-applicable-single-host-v1",
    alerts: "not-applicable-local-acceptance-v1",
  },
} as const;

type ObservabilityProfile = keyof typeof OBSERVABILITY_PROVIDER_REFS;

export type EnvironmentObservabilitySnapshot = {
  version: 1;
  profile: ObservabilityProfile;
  logs: string;
  metrics: string;
  traces: string;
  alerts: string;
};

export function normalizeEnvironmentObservabilitySnapshot(
  value: unknown,
): EnvironmentObservabilitySnapshot | Record<string, never> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("可观测性快照必须是对象");
  }
  const input = value as Record<string, unknown>;
  const profile = String(input.profile) as ObservabilityProfile;
  const expected = OBSERVABILITY_PROVIDER_REFS[profile];
  if (input.version !== 1 || !expected) {
    throw new BadRequestException("可观测性快照版本或 profile 无效");
  }
  for (const key of ["logs", "metrics", "traces", "alerts"] as const) {
    if (input[key] !== expected[key]) {
      throw new BadRequestException(`可观测性 ${key} 必须引用服务端已注册 Provider`);
    }
  }
  return { version: 1, profile, ...expected };
}

export function isKnownObservabilitySnapshot(value: Record<string, unknown>) {
  const profile = String(value.profile) as ObservabilityProfile;
  const expected = OBSERVABILITY_PROVIDER_REFS[profile];
  return value.version === 1 && Boolean(expected) &&
    (["logs", "metrics", "traces", "alerts"] as const)
      .every((key) => value[key] === expected[key]);
}
