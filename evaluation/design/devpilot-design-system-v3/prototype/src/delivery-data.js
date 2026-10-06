import { project } from './data.js';

/** Release, version and deployment fixtures shaped like current responses. */
export const environmentVersionsResponse = {
  environments: [
    environment('env-production', 'production', '生产环境', 'production', 'ev-prod-132', [
      version('ev-prod-132', 'env-production', 'mft-132', '稳定版', '1.3.2', '8f7e6d5', '2026-08-20T14:22:00+08:00', 'DEP-8788'),
      version('ev-prod-131', 'env-production', 'mft-131', '登录修复', '1.3.1', '3c2b1a0', '2026-08-03T11:09:00+08:00', 'DEP-8760'),
    ]),
    environment('env-staging', 'staging', '预发环境', 'staging', 'ev-stage-140', [
      version('ev-stage-140', 'env-staging', 'mft-140', '图库重构', '1.4.0', 'a1b2c3d', '2026-08-26T12:36:00+08:00', 'DEP-8781'),
    ]),
  ],
  candidates: {
    staging: [candidate('mft-140', '图库重构', '1.4.0', 'main', 'a1b2c3d', '2026-08-20T08:31:00+08:00'), candidate('mft-132', '稳定版', '1.3.2', 'release/1.3', '8f7e6d5', '2026-08-10T14:22:00+08:00')],
    production: [candidate('mft-140', '图库重构', '1.4.0', 'main', 'a1b2c3d', '2026-08-20T08:31:00+08:00'), candidate('mft-132', '稳定版', '1.3.2', 'release/1.3', '8f7e6d5', '2026-08-10T14:22:00+08:00'), candidate('mft-131', '登录修复', '1.3.1', 'hotfix/login', '3c2b1a0', '2026-08-03T11:09:00+08:00')],
  },
};

export const releaseOrderListResponse = {
  items: [
    releaseOrder('R-1042', '图库重构', '1.4.0', 'main', 'a1b2c3d', 'production', 'blocked', '2026-08-26T12:40:00+08:00'),
    releaseOrder('R-1038', '稳定版', '1.3.2', 'release/1.3', '8f7e6d5', 'production', 'succeeded', '2026-08-20T14:22:00+08:00'),
    releaseOrder('R-1029', '登录修复', '1.3.1', 'hotfix/login', '3c2b1a0', 'production', 'succeeded', '2026-08-03T11:09:00+08:00'),
  ],
  total: 18,
};

export const deploymentRuns = [
  deployment('DEP-8788', 'R-1038', '生产环境', 'succeeded', '2026-08-20T14:17:28+08:00', '2026-08-20T14:22:00+08:00', '林澈'),
  deployment('DEP-8781', 'R-1038', '预发环境', 'succeeded', '2026-08-20T13:52:09+08:00', '2026-08-20T13:56:00+08:00', '系统'),
];
export const pendingDeploymentRun = deployment('DEP-8821', 'R-1042', '生产环境', 'running', '2026-08-26T12:43:00+08:00', null, '赵行波');

function environment(id, key, name, baselineRole, currentEnvironmentVersionId, environmentVersions) {
  return { id, key, name, baselineRole, currentEnvironmentVersionId, targetReadiness: { ready: true }, environmentVersions };
}

function version(id, environmentId, artifactManifestId, releaseName, releaseVersion, sourceCommitSha, effectiveAt, deploymentRunId) {
  return { id, environmentId, artifactManifestId, previousVersionId: null, kind: 'deploy', effectiveAt, releaseOrder: { id: `order-${releaseVersion}`, releaseName, releaseVersion }, artifactManifest: { id: artifactManifestId, digest: `sha256:${artifactManifestId}`, buildRun: { id: `build-${releaseVersion}`, revision: 1, sourceCommitSha } }, deploymentRun: { id: deploymentRunId, status: 'succeeded', createdAt: effectiveAt, finishedAt: effectiveAt } };
}

function candidate(id, releaseName, releaseVersion, sourceBranch, sourceCommitSha, createdAt) {
  return { id, digest: `sha256:${id}`, createdAt, releaseOrder: { id: `order-${releaseVersion}`, releaseName, releaseVersion }, buildRun: { id: `build-${releaseVersion}`, revision: 1, sourceBranch, sourceCommitSha }, deploymentRuns: [], releaseRuns: [] };
}

function releaseOrder(id, releaseName, releaseVersion, branch, commitSha, phase, status, occurredAt) {
  const failed = status === 'blocked';
  const manifestId = releaseVersion === '1.4.0' ? 'mft_01J6X9P3' : `mft_${releaseVersion.replaceAll('.', '')}`;
  return { id, projectId: project.id, releaseName, releaseVersion, note: null, persistedStatus: failed ? 'active' : 'succeeded', lifecycle: { status: failed ? 'production' : 'succeeded', phase, sourceType: 'release_run', sourceId: `${id}-run`, sourceStatus: status, occurredAt, ...(failed ? { failureKind: 'blocked' } : {}) }, createdAt: occurredAt, source: { branch, commitSha, buildRunId: `${id}-build`, buildRevision: 1, buildStatus: 'succeeded' }, build: { count: 1, recentSuccessfulManifest: { id: manifestId, digest: `sha256:${manifestId}`, buildRunId: `${id}-build`, buildRevision: 1, createdAt: occurredAt } }, deployment: { count: status === 'succeeded' ? 2 : 1, latest: null }, lastExecution: { step: phase, sourceType: 'release_run', sourceId: `${id}-run`, status, occurredAt }, lastExecutedAt: occurredAt };
}

function deployment(id, releaseOrderId, environment, status, startedAt, finishedAt, actorName) {
  return { id, projectId: project.id, environment, projectEnvironment: null, targetType: 'server', dryRun: false, artifactManifest: { id: `manifest-${releaseOrderId}`, releaseOrderId }, source: 'release', status, branch: null, commitSha: null, commandPlan: null, error: null, startedAt, finishedAt, actor: { id: `actor-${actorName}`, name: actorName, email: '' } };
}
