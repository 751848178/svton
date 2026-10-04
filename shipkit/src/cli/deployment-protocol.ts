import type { TargetConfig } from '../shared/types.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { api } from '../shared/http.js';
import { DEPLOYMENT_ENV_CAPABILITY, DEPLOYMENT_IDENTITY_CAPABILITY } from '../shared/deployment-identity.js';

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
