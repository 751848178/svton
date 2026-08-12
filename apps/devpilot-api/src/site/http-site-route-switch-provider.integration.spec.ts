import { ConfigService } from "@nestjs/config";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";
import { HttpSiteRouteSwitchProvider } from "./http-site-route-switch-provider.service";
import type { SiteRouteSwitchInput } from "./site-route-switch.types";

describe("HTTP route-control acceptance protocol", () => {
  let root: string;
  const token = "route-control-integration-token-000000000000000";
  beforeEach(async () => {
    root = await mkdtemp(join(process.cwd(), ".route-http-integration-"));
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("handshakes, enforces CAS, persists restart, clears and restores", async () => {
    const stateFile = join(root, "state.json");
    const first = await server(stateFile);
    const provider = client(first.origin);
    const route = input();
    await expect(provider.verifyProductionCapability()).resolves.toBeUndefined();
    await expect(provider.observeCurrentRoute(scope(route)))
      .resolves.toMatchObject({ status: "absent", route: null });
    await expect(provider.switchRoute(route)).resolves
      .toMatchObject({ status: "switched", observed: observation(route) });
    await expect(provider.switchRoute({ ...route,
      operationId: `site-route:stale:${"b".repeat(64)}` }))
      .resolves.toMatchObject({ status: "failed", reasonCode: "route_switch_cas_conflict" });
    await first.close();

    const restarted = await server(stateFile);
    const resumed = client(restarted.origin);
    await expect(resumed.observeRoute(route.operationId)).resolves
      .toMatchObject({ status: "switched", observed: observation(route) });
    await expect(resumed.compensateRoute({ version: 1, operationId: "clear-1",
      originalOperationId: route.operationId, expectedCurrent: observation(route),
      desiredRoute: null })).resolves.toMatchObject({ status: "switched", observed: null });
    const replacement = { ...route, operationId: "replacement-route",
      deploymentRunId: "replacement", routeHash: "c".repeat(64),
      primaryDomain: "new.parity.example.test", domains: ["new.parity.example.test"],
      expectedCurrent: null };
    await expect(resumed.switchRoute(replacement)).resolves.toMatchObject({ status: "switched" });
    await expect(resumed.compensateRoute({ version: 1, operationId: "restore-1",
      originalOperationId: replacement.operationId,
      expectedCurrent: observation(replacement), desiredRoute: route }))
      .resolves.toMatchObject({ status: "switched", observed: observation(route) });
    await restarted.close();
  });

  it("fails startup closed when persisted state is corrupt", async () => {
    const stateFile = join(root, "state.json");
    await writeFile(stateFile, "{broken", { mode: 0o600 });
    const port = await availablePort();
    const instance = launch(stateFile, port);
    const [code] = await once(instance, "exit");
    expect(code).not.toBe(0);
  });

  async function server(stateFile: string) {
    const port = await availablePort();
    const instance = launch(stateFile, port);
    const origin = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (instance.exitCode !== null) throw new Error("route control exited");
      try { if ((await fetch(`${origin}/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return { origin, close: async () => { instance.kill("SIGTERM");
      if (instance.exitCode === null) await once(instance, "exit"); } };
  }
  function client(origin: string) {
    return new HttpSiteRouteSwitchProvider(new ConfigService({
      SITE_ROUTE_SWITCH_HTTP_ENDPOINT: origin,
      SITE_ROUTE_SWITCH_HTTP_TOKEN: token,
      SITE_ROUTE_SWITCH_HTTP_TIMEOUT_MS: 2000,
    }));
  }
});

function launch(stateFile: string, port: number): ChildProcess {
  return spawn(process.execPath, [join(process.cwd(), "../../scripts/parity-route-control-provider.mjs")], {
    env: { ...process.env, PORT: String(port), ROUTE_CONTROL_TOKEN:
      "route-control-integration-token-000000000000000", ROUTE_CONTROL_STATE_FILE: stateFile },
    stdio: "ignore",
  });
}
async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test port unavailable");
  const port = address.port;
  server.close(); await once(server, "close"); return port;
}

function input(): SiteRouteSwitchInput {
  return { version: 1, operationId: `site-route:apply:${"a".repeat(64)}`,
    teamId: "team", projectId: "project", environmentId: "production",
    siteId: "site", deploymentRunId: "deployment", releaseRunId: "release",
    primaryDomain: "parity.example.test", domains: ["parity.example.test"],
    entries: [], proxyTarget: "http://target-workload/", targetRef: "target",
    routeHash: "a".repeat(64), expectedCurrent: null };
}
function observation(route: SiteRouteSwitchInput) { return { siteId: route.siteId,
  deploymentRunId: route.deploymentRunId, targetRef: route.targetRef,
  routeHash: route.routeHash }; }
function scope(route: SiteRouteSwitchInput) { return { teamId: route.teamId,
  projectId: route.projectId, environmentId: route.environmentId, siteId: route.siteId }; }
