import type { TargetConfig } from '../shared/types.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { api } from '../shared/http.js';
import { DEPLOYMENT_ENV_CAPABILITY, DEPLOYMENT_IDENTITY_CAPABILITY, MULTI_SERVICE_CAPABILITY } from '../shared/deployment-identity.js';

/** Older agents ignore project/env fields: refuse them before any deployment
 *  write, regardless of their package version or otherwise healthy status. */
export async function requireDeploymentProtocol(target: TargetConfig, at: string, keepEnv = false) {
  const rt = await resolveTargetToken(target, at);
  const status = await api<{ role?: string; auth?: { capabilities?: string[] } }>(
    rt.url, rt.token, 'GET', '/api/status', undefined, 15_000,
    rt.caFile ? { caFile: rt.caFile } : {},
  );
  if (!['runtime', 'both'].includes(status?.role ?? '') || !Array.isArray(status?.auth?.capabilities) || !status.auth.capabilities.includes(DEPLOYMENT_IDENTITY_CAPABILITY)) {
    throw new Error('运行端未声明可用的部署身份隔离能力 — 请升级 ship-agent，确认机器包含 runtime 角色并使用 runtime 凭据；本次未发起部署或回滚');
  }
  if (keepEnv && !status.auth.capabilities.includes(DEPLOYMENT_ENV_CAPABILITY)) {
    throw new Error('运行端不支持安全保留环境变量 — 请升级 ship-agent；本次未发起构建或部署');
  }
  return rt;
}

/** multi-service (v2) releases additionally need group snapshots, selective
 *  activation and in-lock merge on BOTH sides; an old agent must be refused
 *  BEFORE a dynamic builder (money) is ever created */
export async function requireGroupProtocol(target: TargetConfig, at: string) {
  const rt = await resolveTargetToken(target, at);
  const status = await api<{ role?: string; auth?: { capabilities?: string[] } }>(
    rt.url, rt.token, 'GET', '/api/status', undefined, 15_000,
    rt.caFile ? { caFile: rt.caFile } : {},
  );
  if (!['runtime', 'both'].includes(status?.role ?? '') || !Array.isArray(status?.auth?.capabilities) ||
    !status.auth.capabilities.includes(DEPLOYMENT_IDENTITY_CAPABILITY) || !status.auth.capabilities.includes(MULTI_SERVICE_CAPABILITY)) {
    throw new Error(
      `运行端不支持多服务发布（需 ${MULTI_SERVICE_CAPABILITY}）— 请两端同时升级 shipkit 后重试；本次未创建构建机、未构建、未部署`,
    );
  }
  return rt;
}

/** builder-side twin: the build request carries target/platform fields an old
 *  builder would reject anyway — refuse it up front with a clear reason */
export async function assertBuilderGroupCapability(o: { url: string; token: string; caFile?: string }) {
  const status = await api<{ role?: string; version?: string; auth?: { capabilities?: string[] } }>(
    o.url, o.token, 'GET', '/api/status', undefined, 15_000,
    o.caFile ? { caFile: o.caFile } : {},
  );
  if (!['builder', 'both'].includes(status?.role ?? '') || !Array.isArray(status?.auth?.capabilities) ||
    !status.auth.capabilities.includes(MULTI_SERVICE_CAPABILITY)) {
    throw new Error(
      `构建机不支持多服务构建（需 ${MULTI_SERVICE_CAPABILITY}，实际版本 ${status?.version ?? '?'}）— 请升级构建机镜像/安装包后重试；本次未构建任何镜像`,
    );
  }
}
