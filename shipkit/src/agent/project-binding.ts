// The app-name binding inside an agent's appDir: which PROJECT and which
// ENVIRONMENT owns this app name on THIS agent (the deployment identity).
//
// CLAIM RULES (strict):
//  - a VALID existing binding must match (project, env) exactly — a different
//    project OR a different environment (prod vs staging on the same agent)
//    is refused explicitly; appDir/compose project cannot host two of them;
//  - AUTO-CLAIM happens only for a genuinely FRESH app: no binding file AND
//    no deployment evidence (no disk entries or containers). An app that was
//    deployed before bindings existed must be MIGRATED explicitly — the
//    operator writes project.json by hand; we never guess the owner;
//  - any problem reading/parsing the binding REFUSES and PRESERVES the
//    original file untouched (read errors, corrupt JSON, invalid shape).

import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../shared/obj.js';
import { validEnvironmentIdentity, validProjectIdentity } from '../shared/deployment-identity.js';

export interface BindingRequest {
  app: string;
  project: string;
  env: string;
}

/** A safety refusal stays latched even if an operator repairs the file before
 * the failed operation enters recovery. */
export class ProjectBindingRefusal extends Error {}

function refuse(message: string): never {
  throw new ProjectBindingRefusal(`拒绝执行：${message}`);
}

/** any evidence that this app name was already deployed here (legacy apps
 *  without a binding must migrate explicitly, not auto-claim) */
async function deploymentEvidence(appDir: string): Promise<string[]> {
  try {
    // Any pre-existing entry (including empty releases/, compose files or a
    // dangling binding symlink) makes automatic ownership attribution unsafe.
    return await readdir(appDir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    refuse(`无法读取旧部署证据 ${appDir} — 请人工检查，不能将读取失败当成全新部署`);
  }
}

/** read-only binding inspection for planning/status reads: absent = unclaimed
 *  (fresh), present = must parse strictly; NEVER writes or claims anything */
export async function inspectProjectBinding(appDir: string): Promise<BindingRequest | null> {
  let text: string;
  try {
    text = await readFile(path.join(appDir, 'project.json'), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    refuse(`无法读取项目绑定 ${path.join(appDir, 'project.json')}（${(e as NodeJS.ErrnoException).code ?? 'EIO'}）— 原文件已保留，请人工检查后重试`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    refuse(`项目绑定 ${path.join(appDir, 'project.json')} 不是合法 JSON（内容损坏）— 原文件已保留，请人工修复或迁移后重试`);
  }
  if (!isRecord(parsed) || typeof parsed.app !== 'string' || !validProjectIdentity(parsed.project) || !validEnvironmentIdentity(parsed.env)) {
    refuse(`项目绑定 ${path.join(appDir, 'project.json')} 结构非法（需 {app,project,env}）— 原文件已保留，请人工检查`);
  }
  return { app: parsed.app, project: parsed.project as string, env: parsed.env as string };
}

/** Planning may read a genuinely fresh name without claiming it. Missing
 * ownership on any existing deployment evidence must refuse before a builder
 * is prepared; it must not expose a foreign combination as an unclaimed app. */
export async function assertProjectBindingForRead(appDir: string, req: BindingRequest): Promise<void> {
  if (await inspectProjectBinding(appDir)) {
    await assertProjectBinding(appDir, req, false, false);
    return;
  }
  if ((await deploymentEvidence(appDir)).length > 0) {
    refuse(`应用 '${req.app}' 已有部署证据但缺少项目绑定 — 请核对原项目与环境后显式迁移绑定；只读规划不会自动认领`);
  }
}

export async function assertProjectBinding(appDir: string, req: BindingRequest, hasContainers = false, allowClaim = true): Promise<void> {
  if (!validProjectIdentity(req.project) || !validEnvironmentIdentity(req.env)) refuse('项目或环境身份非法');
  const file = path.join(appDir, 'project.json');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      if (!allowClaim) refuse(`激活前项目绑定 ${file} 已丢失 — 请核对原项目与环境后显式迁移，不会自动认领`);
      const evidence = await deploymentEvidence(appDir);
      if (hasContainers) evidence.push('已有 Compose 容器');
      if (evidence.length > 0) {
        refuse(
          `应用 '${req.app}' 已有部署证据（${evidence.join('、')}）但缺少项目绑定 ${file} — ` +
          '请核对原项目与环境后显式迁移绑定；不能从本次请求推断原所有者，不会自动认领旧部署',
        );
      }
      await mkdir(appDir, { recursive: true });
      let handle;
      try {
        handle = await open(file, 'wx', 0o600);
      } catch (claimError) {
        if ((claimError as NodeJS.ErrnoException).code === 'EEXIST') {
          // Another claimant won. Verify its record; never overwrite it.
          return assertProjectBinding(appDir, req, hasContainers, allowClaim);
        }
        throw claimError;
      }
      try {
        await handle.writeFile(`${JSON.stringify({ ...req, at: new Date().toISOString() })}\n`);
      } finally {
        await handle.close();
      }
      return;
    }
    refuse(`无法读取项目绑定 ${file}（${code ?? 'EIO'}）— 原文件已保留，请人工检查后重试`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    refuse(`项目绑定 ${file} 不是合法 JSON（内容损坏）— 原文件已保留，请人工修复或迁移后重试`);
  }
  if (!isRecord(parsed)) refuse(`项目绑定 ${file} 结构非法 — 原文件已保留，请人工检查`);
  const bound = parsed;
  if (bound.app !== req.app || !validProjectIdentity(bound.project) || !validEnvironmentIdentity(bound.env)) {
    refuse(`项目绑定 ${file} 结构非法（app=${JSON.stringify(bound.app)}，需 {app,project,env}）— 原文件已保留，请人工检查`);
  }
  if (bound.project !== req.project) {
    refuse(
      `应用 '${req.app}' 已绑定到其他项目（${bound.project}，本次为 ${req.project}）— ` +
      '同一下发根目录内同名应用不得跨项目共享；请为应用更名或使用不同 Docker daemon 的目标',
    );
  }
  if (bound.env !== req.env) {
    refuse(
      `应用 '${req.app}' 已绑定到 '${bound.env}' 环境（本次为 '${req.env}'，项目 ${req.project}）— ` +
      `同一 agent 上一个应用名只能服务一个环境（共享 appDir 与 compose 项目会互相覆盖）；${req.env} 环境请使用不同 Docker daemon 的目标或为应用更名`,
    );
  }
}
