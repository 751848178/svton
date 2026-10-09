// Read-only, credential-free history projection and retained-snapshot availability.
import type { GroupHistoryView, GroupHistoryRelease, GroupServiceSource } from '../shared/group-protocol.js';
import { publicGitRepoUrl } from '../shared/git-url.js';
import { assertProjectBindingForRead, type BindingRequest } from './project-binding.js';
import { GroupStore, type GroupRelease } from './group-store.js';
export function publicSource(source: GroupServiceSource): GroupServiceSource {
  let repo = source.repo ? publicGitRepoUrl(source.repo) : undefined;
  if (repo) { try { const url = new URL(repo); url.search = ''; url.hash = ''; repo = url.toString(); } catch { /* scp-style git URL */ } }
  return { type: source.type,
    ...(repo ? { repo } : {}), ...(source.sha ? { sha: source.sha } : {}),
    ...(source.ref ? { ref: source.ref } : {}), ...(source.contentDigest ? { contentDigest: source.contentDigest } : {}),
  };
}
function publicServices(release: GroupRelease | null): GroupHistoryRelease['services'] {
  return Object.fromEntries(Object.entries(release?.services ?? {}).map(([name, entry]) => [name, {
    imageRef: entry.imageRef, hasEnv: entry.hasEnv,
    ...(entry.source ? { source: publicSource(entry.source) } : {}),
    ...(entry.configRef ? { configRef: entry.configRef } : {}),
  }]));
}
export async function groupHistory(store: GroupStore, identity: BindingRequest): Promise<GroupHistoryView> {
  await store.assertLayout(identity.app);
  await assertProjectBindingForRead(store.appDir(identity.app), identity);
  const state = await store.loadState(identity.app);
  const items: GroupHistoryRelease[] = [];
  for (const item of state.history) {
    let reason: string | undefined;
    const release = await store.loadRelease(identity.app, item.releaseId).catch(() => null);
    const parent = release?.parent ? await store.loadRelease(identity.app, release.parent).catch(() => null) : null;
    if (!release) reason = '历史变更快照已过期、缺失或损坏';
    else if (!release.parent) reason = '首次部署没有变更前快照';
    else if (!parent) reason = '变更前快照已过期、缺失或环境文件不完整';
    items.push({
      releaseId: item.releaseId, parentReleaseId: release?.parent ?? null,
      changedServices: item.changedServices, createdAt: release?.createdAt ?? item.at, event: item.event,
      rollbackAvailable: !reason, ...(reason ? { reason } : {}), targetSnapshotId: release?.parent ?? null,
      services: publicServices(release), restoreServices: publicServices(parent),
    });
  }
  return { schemaVersion: 2, app: identity.app, current: state.current, items };
}
