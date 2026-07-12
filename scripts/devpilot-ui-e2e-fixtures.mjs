import { supervisorFixture } from "./devpilot-ui-e2e-supervisor-fixture.mjs";

export const user = {
  id: "user-demo",
  email: "devpilot-demo@example.test",
  name: "Devpilot Demo",
  avatar: null,
};

export const team = {
  id: "team-demo",
  name: "Devpilot Demo Team",
  description: "UI E2E fixture",
  role: "owner",
  memberCount: 1,
  projectCount: 1,
  createdAt: new Date().toISOString(),
};

const now = new Date().toISOString();

function json(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function resourceFixture() {
  return [
    {
      id: "res-demo-nginx",
      name: "devpilot-demo-target",
      sourceType: "server",
      provider: "docker",
      kind: "docker_container",
      status: "running",
      endpoint: "http://127.0.0.1:18088",
      serverId: "server-demo",
      environment: { id: "env-demo", name: "demo", key: "demo" },
    },
  ];
}

function actionRunsFixture() {
  return [
    {
      id: "run-demo",
      action: "sync",
      status: "completed",
      startedAt: now,
      finishedAt: now,
    },
  ];
}

function jobFixture() {
  return [
    {
      id: "job-demo",
      status: "completed",
      operationKey: "deploy",
      adapterKey: "server_agent",
      attempt: 1,
      maxAttempts: 1,
      dryRun: true,
      createdAt: now,
      server: { name: "devpilot-demo-target" },
      requestedBy: user,
    },
  ];
}

function logsStatsFixture() {
  return {
    total: 1,
    warningCount: 0,
    errorCount: 0,
    byLevel: [{ level: "info", count: 1 }],
  };
}

function emptyListRoutes(pathname) {
  return [
    "/api/projects",
    "/api/applications",
    "/api/sites",
    "/api/backups/plans",
    "/api/deployments/runs",
  ].includes(pathname);
}

export function createFixtureHandler(calls) {
  return (request) => {
    const url = new URL(request.url());
    const method = request.method();
    calls.push(`${method} ${url.pathname}`);
    if (url.pathname.endsWith("/auth/profile")) return json(user);
    if (url.pathname.endsWith("/teams"))
      return method === "POST" ? json(team) : json([team]);
    if (url.pathname.endsWith("/resource-control/resources"))
      return json(resourceFixture());
    if (url.pathname.endsWith("/servers"))
      return json([{ id: "server-demo", name: "devpilot-demo-target" }]);
    if (url.pathname.endsWith("/project-environments"))
      return json([{ id: "env-demo", name: "demo", key: "demo" }]);
    if (url.pathname.endsWith("/team-credentials")) return json([]);
    if (url.pathname.includes("/sync-docker"))
      return json({ id: "sync-demo", status: "completed" });
    if (url.pathname.endsWith("/resource-control/action-runs"))
      return json(actionRunsFixture());
    if (
      url.pathname.endsWith("/resource-control/connection-runs") ||
      url.pathname.endsWith("/resource-control/query-runs")
    )
      return json([]);
    if (url.pathname.endsWith("/server-execution-jobs/supervisor"))
      return json(supervisorFixture());
    if (url.pathname.endsWith("/server-execution-jobs"))
      return json(jobFixture());
    if (url.pathname.endsWith("/server-execution-leases")) return json([]);
    if (url.pathname.endsWith("/server-execution-jobs/process-next"))
      return json({ status: "completed" });
    if (url.pathname.startsWith("/api/logs"))
      return json(url.pathname.endsWith("/stats") ? logsStatsFixture() : []);
    if (url.pathname.startsWith("/api/monitoring/service-slo/dashboard"))
      return json({ summary: {}, services: [] });
    if (url.pathname.startsWith("/api/monitoring")) return json([]);
    if (emptyListRoutes(url.pathname)) return json([]);
    return json([]);
  };
}
