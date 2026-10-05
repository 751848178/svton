// REFUSE to operate when a same-named compose project or container is NOT
// owned by THIS deployment. Generalized from the v1 per-app check: the caller
// names the compose project, the service and the working dir (v1 apps use
// project `ship-<app>` with service === app; v2 groups use
// `ship_<group>_<service>` per service — the underscore cannot appear in
// group/service names, so the derived name is collision-free).
//
// Every existing container of the project — plus any container occupying the
// project's derived names without our label — must carry the compose
// working_dir label of THIS directory. Strictly read-only: inspects, never
// stops, removes or deletes anything; docker errors fail CLOSED (no
// verification ⇒ no modification). Callers run this BEFORE any mutating step.

import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { exec } from '../shared/exec.js';

/** resolve symlinks for comparison (macOS /var→/private/var: compose labels
 *  carry the realpath; an unresolved path would reject our OWN containers) */
async function real(p: string): Promise<string> {
  return realpath(p).catch(() => path.resolve(p));
}

export interface OwnershipSpec {
  /** deployment working dir whose label must own every matching container */
  dir: string;
  /** compose project name (e.g. ship-web / ship_twgg_admin) */
  project: string;
  /** service name inside that compose project */
  service: string;
}

export async function assertOwnedCompose(o: OwnershipSpec): Promise<boolean> {
  const fail = (why: string): Error => new Error(`无法核验 compose 项目 ${o.project} 的资源归属（${why}）— 拒绝执行`);
  const labeled = await exec('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${o.project}`, '--format', '{{.ID}}'], { timeoutMs: 20_000 });
  if (labeled.code !== 0 || labeled.truncated || labeled.timedOut) throw fail('docker ps 按项目标签过滤失败或结果不完整');
  const all = await exec('docker', ['ps', '-a', '--format', '{{.ID}}\t{{.Names}}'], { timeoutMs: 20_000 });
  if (all.code !== 0 || all.truncated || all.timedOut) throw fail('docker ps 列出同名容器失败或结果不完整');
  const ids = new Set(labeled.stdout.split('\n').map((l) => l.trim()).filter(Boolean));
  // EXACT derived-name match (compose v2 `<project>-<service>-<n>`, legacy v1
  // `<project>_<service>_n`): a prefix test would swallow a sibling service
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const derivedName = new RegExp(`^${esc(o.project)}-${esc(o.service)}-\\d+$|^${esc(o.project)}_${esc(o.service)}_\\d+$`);
  for (const line of all.stdout.split('\n')) {
    const [id, name] = line.trim().split('\t');
    if (id && derivedName.test(name ?? '')) ids.add(id); // name squatter (may lack our label)
  }
  if (!ids.size) return false;
  const inspect = await exec('docker', ['inspect', '--format',
    '{{.Name}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.project.working_dir"}}',
    ...ids], { timeoutMs: 20_000 });
  if (inspect.code !== 0 || inspect.truncated || inspect.timedOut) throw fail('docker inspect 失败或结果不完整');
  const rows = inspect.stdout.split('\n').filter((line) => line.trim());
  if (rows.length !== ids.size) throw fail('docker inspect 未返回全部容器的归属');
  const mine = await real(o.dir);
  for (const line of rows) {
    const [name, labelProject, workingDir] = line.trim().split('\t');
    if (!name) continue;
    const owner = (workingDir ?? '').trim();
    if (labelProject !== o.project || !owner || (await real(owner)) !== mine) {
      throw new Error(
        `拒绝执行：容器 ${name}（compose 项目 ${labelProject || o.project}）属于其他部署（工作目录 ${owner || '未知'}，本次部署为 ${mine}）— ` +
        '同名资源不属于当前部署；请人工处理该环境或为服务更名',
      );
    }
  }
  return true; // existing containers are deployment evidence even if local state was lost
}
