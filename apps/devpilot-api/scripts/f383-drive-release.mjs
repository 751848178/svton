/**
 * F383 真实六阶段发布驱动（验证用，非自动化测试）。
 *
 * 通过 API 驱动一次真实发布：preview → create → execute → 逐阶段 approve → 推进到 succeeded。
 * 使用 Picshare backend+admin / dev 环境 / password SSH 目标。每一步打印关键 id 与状态，
 * 绝不打印秘密值。失败即非零退出并打印错误体。
 *
 * 运行：node apps/devpilot-api/scripts/f383-drive-release.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = process.env.F383_API || "http://localhost:3121";
const ADMIN_EMAIL = "admin@devpilot.local";
const ADMIN_PASSWORD = "DemoPass123!";

let token = null;
let teamId = null;

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (teamId) headers["x-team-id"] = teamId;
  const r = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

function dataOf(resp) {
  if (resp.body && typeof resp.body === "object" && "data" in resp.body) return resp.body.data;
  return resp.body;
}

async function login() {
  const r = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const d = dataOf(r);
  token = d?.accessToken || d?.token || d?.access_token;
  if (!token) throw new Error(`login failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  // resolve the user's team from profile (admin belongs to the Picshare team).
  const me = await api("/api/auth/me");
  const meData = dataOf(me);
  teamId = meData?.currentTeamId || meData?.teamId || meData?.team?.id || meData?.teams?.[0]?.id;
  if (!teamId) {
    // fallback: query teams endpoint
    const teams = await api("/api/teams");
    teamId = dataOf(teams)?.[0]?.id;
  }
  if (!teamId) throw new Error(`无法解析 teamId: me=${JSON.stringify(meData).slice(0, 300)}`);
  console.log(`[auth] logged in as ${ADMIN_EMAIL}, team=${teamId}`);
  return token;
}

async function resolveIds() {
  const proj = await prisma.project.findFirst({ where: { name: { contains: "icshare" } }, select: { id: true, name: true, teamId: true } });
  const env = await prisma.projectEnvironment.findFirst({ where: { projectId: proj.id, key: "dev" }, select: { id: true, key: true, name: true } });
  // Picshare backend + admin services (the env that has ResourceInstances = dev)
  const services = await prisma.applicationService.findMany({
    where: { application: { name: { contains: "icshare" } }, environmentId: env.id, status: "active" },
    select: { id: true, name: true, applicationId: true, environmentId: true, serverId: true },
  });
  // password SSH target server: F383 Picshare Deploy (f383-picshare-deploy, on staging net).
  const server = await prisma.server.findFirst({
    where: { host: "f383-picshare-deploy", authType: "password" },
    select: { id: true, name: true, host: true, port: true, authType: true },
  });
  console.log(`[ids] project=${proj.id} env=${env.id} (${env.key}) server=${server?.id} (${server?.name}, authType=${server?.authType})`);
  console.log(`[ids] services:`, services.map((s) => `${s.name}(${s.id})`).join(", "));
  return { proj, env, services, server };
}

async function previewRelease(ctx) {
  const { proj, env, services, server } = ctx;
  const svcInputs = services.map((s) => ({
    applicationId: s.applicationId,
    applicationServiceId: s.id,
    environmentId: env.id,
    serverId: server?.id,
    serviceName: s.name,
  }));
  const body = {
    environmentId: env.id,
    name: `F383 final closure ${new Date().toISOString().slice(0, 16)}`,
    branch: "main",
    gitRepo: proj.gitRepo || undefined,
    services: svcInputs,
  };
  const r = await api(`/api/release-plans/projects/${proj.id}/preview`, { method: "POST", body: JSON.stringify(body) });
  if (r.status !== 200) throw new Error(`preview failed: ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  const d = dataOf(r);
  console.log(`[preview] planHash=${d.planHash} stages=${d.stages?.length} deps=${d.dependencies?.length} approvals=${d.approvalRequired?.length}`);
  return { preview: d, createBody: body };
}

async function createRelease(ctx, preview, createBody) {
  const { proj } = ctx;
  const body = { ...createBody, expectedPlanHash: preview.planHash };
  const r = await api(`/api/release-plans/projects/${proj.id}`, { method: "POST", body: JSON.stringify(body) });
  if (r.status !== 201 && r.status !== 200) throw new Error(`create failed: ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  const d = dataOf(r);
  console.log(`[create] planId=${d.id}`);
  return d;
}

async function executeRelease(projId, planId) {
  const r = await api(`/api/release-plans/${planId}/execute`, { method: "POST" });
  console.log(`[execute] status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`);
  return r;
}

async function getPlan(planId) {
  const r = await api(`/api/release-plans/${planId}`);
  return dataOf(r);
}

// 找到当前 awaiting/blocked 的阶段审批并 approve（admin 作为审批人）。
async function approvePendingStageApprovals(teamId) {
  const pending = await prisma.operationApproval.findMany({
    where: { teamId, category: "release_plan", status: "pending", targetType: "release_stage" },
    orderBy: { createdAt: "asc" },
    select: { id: true, summary: true, targetId: true },
  });
  for (const a of pending) {
    const r = await api(`/api/operation-approvals/${a.id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "approved", reviewComment: "F383 final closure approval" }),
    });
    console.log(`[approve] ${a.id} (${(a.summary || "").slice(0, 40)}) → ${r.status}`);
    if (r.status !== 200 && r.status !== 201) {
      console.log(`  review error: ${JSON.stringify(r.body).slice(0, 200)}`);
    }
  }
  return pending.length;
}

// 重新触发 advancePlan（通过 execute 重入或专用端点）。这里用 execute 重入是幂等的。
async function nudge(projId, planId) {
  await api(`/api/release-plans/${planId}/execute`, { method: "POST" }).catch(() => {});
}

async function driveToTerminal(projId, planId, teamId, maxIters = 30) {
  for (let i = 0; i < maxIters; i++) {
    const plan = await getPlan(planId);
    const stageSummary = (plan.stages || []).map((s) => `${s.type}:${s.status}`).join(" ");
    console.log(`[iter ${i}] plan=${plan.status} | ${stageSummary}`);
    if (["succeeded", "failed", "canceled"].includes(plan.status)) return plan;
    // approve any pending stage approvals, then nudge
    const approved = await approvePendingStageApprovals(teamId);
    await nudge(projId, planId);
    await new Promise((res) => setTimeout(res, 4000));
  }
  return getPlan(planId);
}

async function main() {
  await login();
  const ctx = await resolveIds();
  if (!ctx.server) throw new Error("未找到 password SSH 目标服务器");
  if (ctx.services.length < 2) throw new Error(`Picshare 服务不足（${ctx.services.length}），期望 backend+admin`);
  const { preview, createBody } = await previewRelease(ctx);
  const created = await createRelease(ctx, preview, createBody);
  await executeRelease(ctx.proj.id, created.id);
  const finalPlan = await driveToTerminal(ctx.proj.id, created.id, ctx.proj.teamId);
  console.log("\n=== FINAL ===");
  console.log("planId:", finalPlan.id);
  console.log("plan status:", finalPlan.status);
  console.log("blockedReason:", finalPlan.blockedReason || "(none)");
  for (const s of finalPlan.stages || []) {
    const att = s.attempts?.[s.attempts.length - 1];
    console.log(`  ${s.type} [${s.status}] job=${att?.serverExecutionJobId || att?.deploymentRunId || "-"} attempt=${att?.id || "-"}`);
  }
  process.exitCode = finalPlan.status === "succeeded" ? 0 : 1;
}

main()
  .catch((e) => { console.error("DRIVE FAILED:", e.message); process.exitCode = 2; })
  .finally(() => prisma.$disconnect());
