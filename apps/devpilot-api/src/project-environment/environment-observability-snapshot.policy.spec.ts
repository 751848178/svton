import { BadRequestException } from "@nestjs/common";
import { normalizeEnvironmentObservabilitySnapshot } from "./environment-observability-snapshot.policy";

describe("normalizeEnvironmentObservabilitySnapshot", () => {
  it("accepts only a complete typed provider snapshot", () => {
    expect(normalizeEnvironmentObservabilitySnapshot({
      version: 1,
      profile: "local_acceptance_v1",
      logs: "local-runtime-logs-v1",
      metrics: "local-health-probe-v1",
      traces: "not-applicable-single-host-v1",
      alerts: "not-applicable-local-acceptance-v1",
    })).toMatchObject({ version: 1, profile: "local_acceptance_v1" });
    expect(() => normalizeEnvironmentObservabilitySnapshot({
      version: 1, profile: "local_acceptance_v1", logs: "only-logs",
    })).toThrow(BadRequestException);
    expect(() => normalizeEnvironmentObservabilitySnapshot({
      version: 1,
      profile: "external_provider_v1",
      logs: "https://user:secret@example.test/logs",
      metrics: "anything",
      traces: "anything",
      alerts: "anything",
    })).toThrow("版本或 profile 无效");
  });
});
