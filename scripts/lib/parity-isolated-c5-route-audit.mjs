import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import {
  databaseRouteReadback,
  isolatedC5RouteQueryFor,
  routeExpectationFromDatabaseRow,
} from "./parity-isolated-c5-route-database.mjs";
import { captureRouteControlReadback } from "./parity-route-control-readback.mjs";
import { summarizeRouteAuditProvenance } from "./parity-isolated-c5-route-audit-provenance.mjs";
import { parityRuntimeConfig } from "./parity-runtime-config.mjs";
import { assertOwnedRuntimeResources } from "./parity-runtime-resource-ownership.mjs";

export async function captureIsolatedC5RouteAudit(
  root,
  context,
  historyIdentity,
) {
  const runtime = parityRuntimeConfig(context.environment);
  const auditPath = join(context.runDirectory, "route-control-audit.json");
  const PrismaClient = createRequire(
    resolve(root, "apps/devpilot-api/package.json"),
  )("@prisma/client").PrismaClient;
  const prisma = new PrismaClient({
    datasources: { db: { url: runtime.databaseUrl } },
  });
  let receipt;
  try {
    const row = await prisma.siteRouteSwitchRun.findFirst(
      isolatedC5RouteQueryFor(historyIdentity),
    );
    const expected = routeExpectationFromDatabaseRow(row, historyIdentity);
    const providerReadback = await captureRouteControlReadback({
      origin: runtime.routeControlOrigin,
      token: context.environment.PARITY_ROUTE_CONTROL_TOKEN,
      expected,
    });
    const inventory = assertOwnedRuntimeResources(runtime);
    receipt = {
      schemaVersion: 1,
      status: "verified",
      capturedAt: new Date().toISOString(),
      requestIdentity: {
        ...runtimeIdentity(runtime),
        historyIdentity,
      },
      resultIdentity: {
        routeRunId: row.id,
        operationId: expected.operationId,
        deploymentRunId: expected.deploymentRunId,
        releaseRunId: row.releaseRunId,
        siteId: expected.siteId,
        routeHash: expected.routeHash,
        historyEnvironmentVersionId: historyIdentity.environmentVersionId,
      },
      databaseReadback: databaseRouteReadback(row),
      providerReadback,
      runtimeProvenance: summarizeRouteAuditProvenance(runtime, inventory),
    };
  } catch (error) {
    receipt = {
      schemaVersion: 1,
      status: "not_verified",
      capturedAt: new Date().toISOString(),
      requestIdentity: {
        ...runtimeIdentity(runtime),
        historyIdentity: historyIdentity ?? null,
      },
      failure: safeFailure(error, runtime, context.environment),
    };
  } finally {
    await prisma.$disconnect();
  }
  await writeFile(auditPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    mode: 0o600,
  });
  return Object.freeze({ path: auditPath, receipt });
}

function runtimeIdentity(runtime) {
  return {
    goalId: runtime.goalId,
    runtimeId: runtime.runtimeId,
    sourceRevision: runtime.sourceRevision,
    sourceTreeSha256: runtime.sourceTreeSha256,
    routeControlOrigin: runtime.routeControlOrigin,
    cleanupOwnerFingerprint: createHash("sha256")
      .update(runtime.cleanupOwnerToken)
      .digest("hex"),
  };
}

function safeFailure(error, runtime, environment) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(runtime.databaseUrl, "[database-url-redacted]")
    .replaceAll(environment.PARITY_ROUTE_CONTROL_TOKEN, "[token-redacted]")
    .split("\n")[0]
    .slice(0, 500);
}
