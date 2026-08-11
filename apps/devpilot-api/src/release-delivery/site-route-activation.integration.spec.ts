import "reflect-metadata";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import { probeFinalHttp } from "../site/site-final-http-probe";
import { finalSiteUrl } from "../site/site-final-url";
import type { SiteProbePort } from "../site/site-route-activation.types";
import type { ApprovedSiteProbeTarget } from "../site/site-probe-target.types";
import {
  approveProductionReleaseRun,
  confirmProductionRun,
  createProductionRealGateFixture,
  type ProductionRealGateFixture,
} from "./release-production-real-gate.integration-fixture";

const describeIntegration =
  process.env.RUN_F438_SITE_ROUTE_ACTIVATION_INTEGRATION === "1"
    ? describe
    : describe.skip;

jest.setTimeout(120_000);

describeIntegration(
  "F438 Production route activation + real site probes",
  () => {
    let fixture: ProductionRealGateFixture;
    let prisma: PrismaClient;

    beforeAll(async () => {
      fixture = await createProductionRealGateFixture(exactSiteProbe());
      prisma = fixture.prisma;
    });

    afterAll(async () => fixture.stop());

    it("switches the matching Site to the new DeploymentRun and records real probe evidence", async () => {
      const f = fixture;
      const server = await startHttpServer(200, "f438-site-ok");
      try {
        await pointRouteAt(prisma, f.configRevisionId, f.siteId, server);
        const domain = serverDomain(server);
        const releaseRun = await confirmProductionRun(f, `switch-${f.scope}`);
        await approveProductionReleaseRun(f, releaseRun.id);
        const executed = await f.service.execute({
          teamId: f.teamId,
          actorId: f.userId,
          projectId: f.projectId,
          environmentId: f.productionEnvironmentId,
          kind: "upgrade",
          manifestId: f.manifestId,
          releaseRunId: releaseRun.id,
        });

        expect(executed.run).toMatchObject({ status: "completed" });

        const run = await prisma.deploymentRun.findUniqueOrThrow({
          where: { id: executed.run.id },
        });
        const result = run.result as Record<string, any>;
        expect(result.siteProbe).toMatchObject({
          version: 1,
          primaryDomain: domain,
          dns: { status: "resolved", hostname: domain },
          tls: { status: "unavailable" },
          http: {
            status: "passed",
            statusCode: 200,
            finalUrl: serverUrl(server),
            url: serverUrl(server),
          },
        });
        expect(typeof result.siteProbe.http.bodySignature).toBe("string");
        expect(result.siteProbe.http.bodySignature).toMatch(/^sha256:/);
        expect(result.routeSwitch).toMatchObject({
          version: 1,
          siteId: f.siteId,
          deploymentRunId: executed.run.id,
          status: "switched",
          reasonCode: "site_route_switched",
          targetRef: "filesystem-release-target",
          domains: [domain],
        });
        expect(typeof result.routeSwitch.switchedAt).toBe("string");

        const site = await prisma.site.findUniqueOrThrow({
          where: { id: f.siteId },
        });
        expect(site.routeSwitch).toMatchObject({
          deploymentRunId: executed.run.id,
          targetRef: "filesystem-release-target",
          status: "switched",
        });
        expect(["resolved", "unavailable"]).toContain((site.dns as any).status);
        expect((site.tls as any).probe).toMatchObject({
          status: "unavailable",
        });

        const switchRun = await prisma.siteRouteSwitchRun.findFirst({
          where: { siteId: f.siteId, deploymentRunId: executed.run.id },
        });
        expect(switchRun).not.toBeNull();
        expect(switchRun!.status).toBe("committed");
        expect(switchRun!.targetRef).toBe("filesystem-release-target");
      } finally {
        await closeServer(server);
      }
    });

    it("fails the run closed when the site HTTP probe hard-fails while retaining truthful provider evidence", async () => {
      const f = fixture;
      const server = await startHttpServer(500, "f438-site-broken");
      const before = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
        select: { currentEnvironmentVersionId: true },
      });
      const siteBefore = await prisma.site.findUniqueOrThrow({
        where: { id: f.siteId },
        select: { routeSwitch: true },
      });
      try {
        await pointRouteAt(prisma, f.configRevisionId, f.siteId, server);
        const releaseRun = await confirmProductionRun(
          f,
          `probe-fail-${f.scope}`,
        );
        await approveProductionReleaseRun(f, releaseRun.id);
        const executed = await f.service.execute({
          teamId: f.teamId,
          actorId: f.userId,
          projectId: f.projectId,
          environmentId: f.productionEnvironmentId,
          kind: "upgrade",
          manifestId: f.manifestId,
          releaseRunId: releaseRun.id,
        });

        expect(executed.run).toMatchObject({ status: "failed" });
        expect(executed.version).toBeNull();

        const run = await prisma.deploymentRun.findUniqueOrThrow({
          where: { id: executed.run.id },
        });
        expect((run.result as any).siteProbe).toMatchObject({
          http: { status: "failed", statusCode: 500 },
        });

        const after = await prisma.projectEnvironment.findUniqueOrThrow({
          where: { id: f.productionEnvironmentId },
          select: { currentEnvironmentVersionId: true },
        });
        expect(after.currentEnvironmentVersionId).toBe(
          before.currentEnvironmentVersionId,
        );
        const siteAfter = await prisma.site.findUniqueOrThrow({
          where: { id: f.siteId },
          select: { routeSwitch: true },
        });
        expect(siteAfter.routeSwitch).toEqual(siteBefore.routeSwitch);
        const compensated = await prisma.siteRouteSwitchRun.findFirstOrThrow({
          where: { siteId: f.siteId, deploymentRunId: executed.run.id },
        });
        expect(compensated.status).toBe("compensated");

        const failedRun = await prisma.releaseRun.findUniqueOrThrow({
          where: { id: releaseRun.id },
        });
        expect(failedRun.status).toBe("failed");
        expect(failedRun.errorCode).toBe("ENVIRONMENT_DEPLOYMENT_FAILED");
        const approval = await prisma.operationApproval.findUniqueOrThrow({
          where: { id: releaseRun.operationApprovalId! },
        });
        expect(approval.consumedAt).toBeNull();
      } finally {
        await closeServer(server);
      }
    });

    it("fails closed when the route declares domains but no matching Site exists (production refused, pointer unmoved)", async () => {
      const f = fixture;
      await prisma.site.delete({ where: { id: f.siteId } });
      const before = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
        select: { currentEnvironmentVersionId: true },
      });
      const releaseRun = await confirmProductionRun(
        f,
        `switch-fail-${f.scope}`,
      );
      await approveProductionReleaseRun(f, releaseRun.id);
      const error = await f.service
        .execute({
          teamId: f.teamId,
          actorId: f.userId,
          projectId: f.projectId,
          environmentId: f.productionEnvironmentId,
          kind: "upgrade",
          manifestId: f.manifestId,
          releaseRunId: releaseRun.id,
        })
        .catch((item: unknown) => item);
      expect(
        (error as { getResponse?: () => unknown }).getResponse?.(),
      ).toMatchObject({
        code: "RELEASE_GATE_BLOCKED",
      });

      const runs = await prisma.deploymentRun.findMany({
        where: { releaseRunId: releaseRun.id, status: { not: "running" } },
      });
      expect(runs).toEqual([]);
      const after = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
        select: { currentEnvironmentVersionId: true },
      });
      expect(after.currentEnvironmentVersionId).toBe(
        before.currentEnvironmentVersionId,
      );
      const run = await prisma.releaseRun.findUniqueOrThrow({
        where: { id: releaseRun.id },
      });
      expect(run.status).toBe("awaiting_approval");
      const approval = await prisma.operationApproval.findUniqueOrThrow({
        where: { id: releaseRun.operationApprovalId! },
      });
      expect(approval.consumedAt).toBeNull();
    });
  },
);

async function pointRouteAt(
  prisma: PrismaClient,
  configRevisionId: string,
  siteId: string,
  server: Server,
) {
  const domain = serverDomain(server);
  await prisma.environmentConfigRevision.update({
    where: { id: configRevisionId },
    data: {
      routeSnapshot: {
        domains: [domain],
        proxyTarget: "http://127.0.0.1:1/unrelated",
        tlsRequired: false,
      },
    },
  });
  await prisma.site.update({
    where: { id: siteId },
    data: { primaryDomain: domain },
  });
}

function startHttpServer(status: number, body: string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(status, { "content-type": "text/plain" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function serverUrl(server: Server) {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/`;
}

function serverDomain(server: Server) {
  const address = server.address() as AddressInfo;
  return `127.0.0.1:${address.port}`;
}

function exactSiteProbe(): SiteProbePort {
  return {
    async probe(input) {
      const finalUrl = finalSiteUrl(input.primaryDomain, input.tlsRequired);
      const checkedAt = new Date().toISOString();
      return {
        version: 1,
        primaryDomain: input.primaryDomain,
        finalUrl,
        probedAt: checkedAt,
        dns: {
          status: input.primaryDomain ? "resolved" : "unavailable",
          hostname: input.primaryDomain,
          records: input.primaryDomain ? ["127.0.0.1"] : [],
          checkedAt,
        },
        tls: { status: "unavailable", checkedAt },
        http: await probeFinalHttp(
          approvedLoopbackTarget(finalUrl),
          input.timeoutMs ?? 1000,
        ),
      };
    },
  };
}

function approvedLoopbackTarget(
  value: string | null,
): ApprovedSiteProbeTarget | null {
  if (!value) return null;
  const url = new URL(value);
  const family = 4 as const;
  return {
    url: url.toString(),
    protocol: url.protocol as "http:" | "https:",
    hostname: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "http:" ? 80 : 443,
    hostHeader: url.host,
    path: `${url.pathname}${url.search}`,
    address: "127.0.0.1",
    family,
    addresses: [{ address: "127.0.0.1", family }],
  };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}
