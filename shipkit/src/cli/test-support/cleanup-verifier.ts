// Cleanup + residue verification for the real-Docker e2e (S05/R12): removes
// ONLY this run's exact identities (compose project labels, exact network and
// volume names, exact image repo:tag refs we built) and then PROVES zero
// residue by re-querying Docker — a failed query is a FAILURE, never "empty",
// and an image whose rmi conflicted stays a residue. Pre-existing or shared
// images are never force-deleted to fake a clean result; the before/after
// image snapshot instead proves that nothing NEW from this run survived.

export interface RunResult { code: number; stdout: string; stderr: string }
export type RunFn = (cmd: string) => Promise<RunResult>;

export interface CleanupScope {
  /** compose project names (labels) whose containers/networks are ours */
  projects: string[];
  /** docker network names we created by exact name */
  networks: string[];
  /** docker volume names we created by exact name */
  volumes: string[];
  /** image repo:tag refs we BUILT this run (exact) */
  imageTags: string[];
  /** repo:tag snapshot taken BEFORE the run started */
  beforeImages: string[];
  /** dangling image IDs present BEFORE the run (untagged entries share the
   *  literal '<none>:<none>' tag line, so they need an ID-level diff) */
  beforeDangling?: string[];
}

export interface CleanupReport {
  problems: string[];
  removed: { containers: number; networks: number; volumes: number; images: number };
}

const list = (stdout: string): string[] => stdout.split('\n').map((l) => l.trim()).filter(Boolean);

async function must(run: RunFn, cmd: string, problems: string[], what: string): Promise<RunResult | null> {
  const r = await run(cmd).catch((e: unknown) => ({ code: 1, stdout: '', stderr: String((e as Error)?.message ?? e) }));
  if (r.code !== 0) {
    problems.push(`${what} query failed (exit ${r.code}): ${String(r.stderr).slice(0, 140)}`);
    return null;
  }
  return r;
}

/** every image tag currently present (exact repo:tag lines) */
export async function snapshotImages(run: RunFn): Promise<string[] | null> {
  const r = await run(`docker images --format '{{.Repository}}:{{.Tag}}'`).catch(() => null);
  if (!r || r.code !== 0) return null;
  return list(r.stdout);
}

/** dangling (untagged) image IDs — a new dangling ID is this run's residue */
export async function snapshotDangling(run: RunFn): Promise<string[] | null> {
  const r = await run(`docker images --no-trunc --filter dangling=true --format '{{.ID}}'`).catch(() => null);
  if (!r || r.code !== 0) return null;
  return list(r.stdout);
}

/** Refuse to start a destructive e2e without both successful baselines. */
export async function captureCleanupBaseline(run: RunFn): Promise<{ beforeImages: string[]; beforeDangling: string[] }> {
  const beforeImages = await snapshotImages(run);
  if (beforeImages === null) throw new Error('cleanup baseline image query failed');
  const beforeDangling = await snapshotDangling(run);
  if (beforeDangling === null) throw new Error('cleanup baseline dangling image query failed');
  return { beforeImages, beforeDangling };
}

export async function cleanupAndVerify(run: RunFn, scope: CleanupScope): Promise<CleanupReport> {
  const problems: string[] = [];
  const removed = { containers: 0, networks: 0, volumes: 0, images: 0 };
  const before = new Set(scope.beforeImages);

  // containers by exact compose project label
  for (const project of scope.projects) {
    const r = await must(run, `docker ps -aq --filter label=com.docker.compose.project=${project}`, problems, `containers of ${project}`);
    if (!r) continue;
    for (const id of list(r.stdout)) {
      const rm = await run(`docker rm -f ${id}`).catch((e: unknown) => ({ code: 1, stdout: '', stderr: String(e) }));
      if (rm.code === 0) removed.containers++;
      else problems.push(`cannot remove container ${id} of ${project}: ${String(rm.stderr).slice(0, 140)}`);
    }
  }

  // networks: compose project networks by label + our exact names
  const netNames = new Set<string>();
  for (const project of scope.projects) {
    const r = await must(run, `docker network ls --filter label=com.docker.compose.project=${project} --format '{{.Name}}'`, problems, `networks of ${project}`);
    if (r) for (const n of list(r.stdout)) netNames.add(n);
  }
  for (const n of scope.networks) netNames.add(n);
  for (const n of netNames) {
    const rm = await run(`docker network rm ${n}`).catch((e: unknown) => ({ code: 1, stdout: '', stderr: String(e) }));
    if (rm.code === 0) removed.networks++;
    else if (!/not found/i.test(String(rm.stderr))) problems.push(`network ${n}: ${String(rm.stderr).slice(0, 140)}`);
  }

  for (const v of scope.volumes) {
    const rm = await run(`docker volume rm ${v}`).catch((e: unknown) => ({ code: 1, stdout: '', stderr: String(e) }));
    if (rm.code === 0) removed.volumes++;
    else if (!/not found|in use/i.test(String(rm.stderr))) problems.push(`volume ${v}: ${String(rm.stderr).slice(0, 140)}`);
  }

  // images we BUILT: remove by exact repo:tag. A conflict means the image is
  // still in use/present — that stays a residue, never silently ignored (S05)
  for (const tag of scope.imageTags) {
    if (before.has(tag)) continue; // tracking a shared tag never grants ownership
    const rm = await run(`docker rmi ${tag}`).catch((e: unknown) => ({ code: 1, stdout: '', stderr: String(e) }));
    if (rm.code === 0) removed.images++;
    else if (!/no such image|No such image/i.test(String(rm.stderr))) problems.push(`image ${tag}: rmi failed (still present?): ${String(rm.stderr).slice(0, 140)}`);
  }

  // ---- residue verification: re-query; failed queries FAIL the check ----
  for (const project of scope.projects) {
    const c = await must(run, `docker ps -aq --filter label=com.docker.compose.project=${project}`, problems, `residue containers of ${project}`);
    if (c && list(c.stdout).length > 0) problems.push(`residue containers for ${project}: ${list(c.stdout).join(',')}`);
    const n = await must(run, `docker network ls --filter label=com.docker.compose.project=${project} --format '{{.Name}}'`, problems, `residue networks of ${project}`);
    if (n && list(n.stdout).length > 0) problems.push(`residue networks for ${project}: ${list(n.stdout).join(',')}`);
  }
  const nets = await must(run, `docker network ls --format '{{.Name}}'`, problems, 'network list');
  if (nets) for (const n of scope.networks) if (list(nets.stdout).includes(n)) problems.push(`residue network ${n}`);
  const vols = await must(run, `docker volume ls --format '{{.Name}}'`, problems, 'volume list');
  if (vols) for (const v of scope.volumes) if (list(vols.stdout).includes(v)) problems.push(`residue volume ${v}`);

  // before/after snapshot: only NEW tags from THIS run count as residue;
  // pre-existing or shared images must survive untouched
  const after = await snapshotImages(run);
  if (!after) problems.push('image list query failed during residue verification');
  else {
    for (const tag of after) if (!before.has(tag)) problems.push(`new image residue (not present before the run): ${tag}`);
    const present = new Set(after);
    for (const tag of before) if (!present.has(tag)) problems.push(`pre-existing image missing after cleanup: ${tag}`);
  }
  // dangling images all render as '<none>:<none>' — diff them by ID
  const afterDangling = await snapshotDangling(run);
  if (!afterDangling) problems.push('dangling image query failed during residue verification');
  else {
    const beforeDangling = new Set(scope.beforeDangling ?? []);
    for (const id of afterDangling) if (!beforeDangling.has(id)) problems.push(`new dangling image residue: ${id}`);
    const present = new Set(afterDangling);
    for (const id of beforeDangling) if (!present.has(id)) problems.push(`pre-existing dangling image missing after cleanup: ${id}`);
  }
  return { problems, removed };
}
