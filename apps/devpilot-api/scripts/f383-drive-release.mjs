/**
 * F383 真实六阶段发布驱动（验证用，非自动化测试）。
 *
 * 安全收敛（本会话重写）：
 *  - 管理员凭据由环境变量注入（DEVPILOT_ADMIN_EMAIL / DEVPILOT_ADMIN_PASSWORD），缺失即非零退出。
 *    不再在仓库中硬编码密码。
 *  - 审批只处理「当前 plan」产生的 release-stage 审批（按 releaseStageId join 到当前 plan），
 *    绝不审批其他项目/计划的审批。
 *  - 项目/环境/服务/服务器精确匹配（等值，非模糊 contains），缺失即非零退出。
 *  - 分支以 Project.config.source.branch 为权威；断言为 master，否则非零退出。不再写死 main。
 *  - 日志只打印 id/状态/安全摘要；不打印 token/密码/完整响应体。
 *
 * 运行：
 *   DEVPILOT_ADMIN_PASSWORD=... node apps/devpilot-api/scripts/f383-drive-release.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = process.env.F383_API || "http://localhost:3121";

// 凭据由环境注入；缺失即明确失败（不硬编码、不静默）。
const ADMIN_EMAIL = process.env.DEVPILOT_ADMIN_EMAIL || "admin@devpilot.local";
const ADMIN_PASSWORD = process.env.DEVPILOT_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("[fatal] 缺少 DEVPILOT_ADMIN_PASSWORD 环境变量");
  process.exitCode = 2;
  process.exit(2);
}

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
  if (!token || r.status !== 200 && r.status !== 201) {
    // 只打印 status，不打印响应体（避免泄漏）
    throw new Error(`login failed: status=${r.status}`);
  }
  const me = await api("/api/auth/me");
  const meData = dataOf(me);
  teamId = meData?.currentTeamId || meData?.teamId || meData?.team?.id;
  if (!teamId) throw new Error(`无法解析 teamId（me 未返回团队信息）`);
  console.log(`[auth] logged in (team=${teamId})`);
  return token;
}

// 精确匹配：项目名、环境 key、服务名、服务器 host+authType。任一缺失即失败。
async function resolveIds() {
  const proj = await prisma.project.findFirst({
    where: { name: "Picshare" },
    select: { id: true, name: true, teamId: true, gitRepo: true, config: true },
  });
  if (!proj) throw new Error(`未找到项目「Picshare」（精确匹配）`);
  const env = await prisma.projectEnvironment.findFirst({
    where: { projectId: proj.id, key: "dev" },
    select: { id: true, key: true, name: true },
  });
  if (!env) throw new Error(`未找到环境 dev（精确匹配）`);
  // 精确匹配 backend + admin 两个服务名
  const services = await prisma.applicationService.findMany({
    where: {
      environmentId: env.id,
      status: "active",
      application: { teamId: proj.teamId },
      name: { in: ["backend", "admin"] },
    },
    select: { id: true, name: true, applicationId: true, environmentId: true, serverId: true },
  });
  if (services.length !== 2) {
    throw new Error(`Picshare 服务数量不符（${services.length}），期望精确匹配 backend+admin`);
  }
  const server = await prisma.server.findFirst({
    where: { host: "f383-picshare-deploy", authType: "password" },
    select: { id: true, name: true, host: true, port: true, authType: true },
  });
  if (!server) throw new Error(`未找到 password SSH 目标服务器（host=f383-picshare-deploy）`);
  // 分支：以 Project.config.source.branch 为权威，断言为 master。
  const projectBranch = readProjectSourceBranch(proj.config);
  if (projectBranch !== "master") {
    throw new Error(`项目配置分支为「${projectBranch}」，期望 master（F383 Picshare 必须用 master）`);
  }
  console.log(`[ids] project=${proj.id} env=${env.id} (dev) server=${server.id} branch=${projectBranch}`);
  console.log(`[ids] services:`, services.map((s) => `${s.name}(${s.id})`).join(", "));
  return { proj, env, services, server, branch: projectBranch };
}

function readProjectSourceBranch(config) {
  if (!config || typeof config !== "object") return undefined;
  const source = config.source;
  if (!source || typeof source !== "object") return undefined;
  const b = source.branch;
  return typeof b === "string" && b.trim() ? b.trim() : undefined;
}

async function previewRelease(ctx) {
  const { proj, env, services, server, branch } = ctx;
  const svcInputs = services.map((s) => ({
    applicationId: s.applicationId,
    applicationServiceId: s.id,
    environmentId: env.id,
    serverId: server.id,
    serviceName: s.name,
  }));
  const body = {
    environmentId: env.id,
    name: `F383 final closure ${new Date().toISOString().slice(0, 16)}`,
    // 分支由项目配置继承（不传显式分支，orchestrator 会用 Project.config.source.branch=master）
    gitRepo: proj.gitRepo || undefined,
    services: svcInputs,
  };
  const r = await api(`/api/release-plans/projects/${proj.id}/preview`, { method: "POST", body: JSON.stringify(body) });
  if (r.status !== 200) throw new Error(`preview failed: status=${r.status}`);
  const d = dataOf(r);
  console.log(`[preview] planHash=${d.planHash} stages=${d.stages?.length}`);
  return { preview: d, createBody: body };
}

async function createRelease(ctx, preview, createBody) {
  const { proj } = ctx;
  const body = { ...createBody, expectedPlanHash: preview.planHash };
  const r = await api(`/api/release-plans/projects/${proj.id}`, { method: "POST", body: JSON.stringify(body) });
  if (r.status !== 201 && r.status !== 200) throw new Error(`create failed: status=${r.status}`);
  const d = dataOf(r);
  console.log(`[create] planId=${d.id}`);
  return d;
}

async function executeRelease(planId) {
  const r = await api(`/api/release-plans/${planId}/execute`, { method: "POST" });
  console.log(`[execute] status=${r.status}`);
  return r;
}

async function getPlan(planId) {
  const r = await api(`/api/release-plans/${planId}`);
  return dataOf(r);
}

// 只审批「当前 plan」产生的 release-stage 审批：通过 releaseStage join 到当前 plan。
// 不得审批其他项目/计划的审批。
async function approvePendingStageApprovalsForPlan(teamId, planId) {
  // 查当前 plan 的所有 release stage id
  const stages = await prisma.releaseStage.findMany({
    where: { releasePlanId: planId },
    select: { id: true },
  });
  const stageIds = stages.map((s) => s.id);
  if (stageIds.length === 0) return 0;
  const pending = await prisma.operationApproval.findMany({
    where: {
      teamId,
      category: "release_plan",
      status: "pending",
      targetType: "release_stage",
      targetId: { in: stageIds },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, targetId: true },
  });
  let approved = 0;
  for (const a of pending) {
    const r = await api(`/api/operation-approvals/${a.id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "approved", reviewComment: "F383 final closure approval" }),
    });
    if (r.status === 200 || r.status === 201) approved++;
    else console.log(`[approve] ${a.id} 失败 status=${r.status}（不打印响应体）`);
  }
  return approved;
}

async function nudge(planId) {
  await api(`/api/release-plans/${planId}/execute`, { method: "POST" }).catch(() => {});
}

async function driveToTerminal(planId, teamId, maxIters = 30) {
  for (let i = 0; i < maxIters; i++) {
    const plan = await getPlan(planId);
    const stageSummary = (plan.stages || []).map((s) => `${s.type}:${s.status}`).join(" ");
    console.log(`[iter ${i}] plan=${plan.status} | ${stageSummary}`);
    if (["succeeded", "failed", "canceled"].includes(plan.status)) return plan;
    const approved = await approvePendingStageApprovalsForPlan(teamId, planId);
    if (approved > 0) console.log(`[approve] 本计划审批 ${approved} 条已批准`);
    await nudge(planId);
    await new Promise((res) => setTimeout(res, 4000));
  }
  return getPlan(planId);
}

async function main() {
  await login();
  const ctx = await resolveIds();
  const { preview, createBody } = await previewRelease(ctx);
  const created = await createRelease(ctx, preview, createBody);
  await executeRelease(created.id);
  const finalPlan = await driveToTerminal(created.id, ctx.proj.teamId);
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
