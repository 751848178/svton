import { ConfigService } from "@nestjs/config";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SiteFinalProbeService } from "./site-final-probe.service";
import { SiteProbeLocalAcceptancePolicy } from "./site-probe-local-acceptance.policy";
import { SiteProbeResolverService } from "./site-probe-resolver.service";

describe("local hosts final-site probe", () => {
  it("probes the exact hosts domain and unique local Ingress port", async () => {
    const server = createServer((_request, response) =>
      response.end("Parity Target Workload"),
    );
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;
    try {
      const policy = new SiteProbeLocalAcceptancePolicy(
        config({
          SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE: "parity-hosts-v1",
          SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME: "parity.example.test",
          SITE_PROBE_LOCAL_ACCEPTANCE_PORT: String(port),
          PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
          PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
          PARITY_RUNTIME_ID: `c5-${"a".repeat(8)}-${"b".repeat(32)}`,
          PARITY_SOURCE_REVISION: "c".repeat(40),
        }),
      );
      const resolver = new SiteProbeResolverService(
        async () => [{ address: "127.0.0.1", family: 4 }],
        policy,
      );
      const result = await new SiteFinalProbeService(resolver, policy).probe({
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "production-1",
        deploymentRunId: "deployment-1",
        primaryDomain: "parity.example.test",
        tlsRequired: false,
      });

      expect(result).toMatchObject({
        finalUrl: `http://parity.example.test:${port}/`,
        dns: { status: "resolved", records: ["127.0.0.1"] },
        tls: { status: "not_required" },
        http: {
          status: "passed",
          url: `http://parity.example.test:${port}/`,
          statusCode: 200,
        },
      });
      expect(result.http.bodySignature).toMatch(/^sha256:[a-f0-9]{64}$/);
    } finally {
      server.close();
    }
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
