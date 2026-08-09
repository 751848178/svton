import { ConfigService } from "@nestjs/config";
import { parseSiteProbeTarget } from "./site-probe-target.policy";
import { SiteProbeLocalAcceptancePolicy } from "./site-probe-local-acceptance.policy";

describe("explicit local site-probe acceptance", () => {
  it("is disabled without the exact verified parity profile", () => {
    const policy = new SiteProbeLocalAcceptancePolicy(config({}));
    expect(policy.finalUrl("parity.example.test", false)).toBeNull();
    expect(policy.allows(target(), [{ address: "127.0.0.1", family: 4 }])).toBe(
      false,
    );
  });

  it("allows only the exact hosts domain, unique ingress port and local address", () => {
    const policy = new SiteProbeLocalAcceptancePolicy(config(validConfig()));
    expect(policy.finalUrl("parity.example.test", false)).toBe(
      "http://parity.example.test:54321/",
    );
    expect(
      policy.allows(target(), [{ address: "172.24.0.8", family: 4 }]),
    ).toBe(true);
    expect(
      policy.allows(target(), [{ address: "198.18.0.1", family: 4 }]),
    ).toBe(false);
    expect(policy.finalUrl("metadata.internal", false)).toBeNull();
    expect(policy.finalUrl("parity.example.test", true)).toBeNull();
  });

  it.each([
    ["SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE", "production"],
    ["SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME", "other.example.test"],
    ["PARITY_GOAL_ID", "other-goal"],
    ["PARITY_REQUIRE_VERIFIED_RUNTIME", "0"],
    ["PARITY_RUNTIME_ID", "devpilot-parity"],
    ["PARITY_SOURCE_REVISION", "unverified"],
    ["SITE_PROBE_LOCAL_ACCEPTANCE_PORT", "80"],
  ])("fails closed when %s is invalid", (key, value) => {
    const policy = new SiteProbeLocalAcceptancePolicy(
      config({ ...validConfig(), [key]: value }),
    );
    expect(policy.finalUrl("parity.example.test", false)).toBeNull();
  });
});

function target() {
  return parseSiteProbeTarget("http://parity.example.test:54321/");
}

function validConfig() {
  return {
    SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE: "parity-hosts-v1",
    SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME: "parity.example.test",
    SITE_PROBE_LOCAL_ACCEPTANCE_PORT: "54321",
    PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
    PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
    PARITY_RUNTIME_ID: `c5-${"a".repeat(8)}-${"b".repeat(32)}`,
    PARITY_SOURCE_REVISION: "c".repeat(40),
  };
}

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
