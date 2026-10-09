import { loadConfig } from '../shared/config.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { api, ApiError } from '../shared/http.js';
import { publicUrl } from './project-context.js';
import type { AgentRole, AgentStatus, ShipConfig, TargetConfig } from '../shared/types.js';
import type { ProjectInput } from './contracts.js';

export interface ConfiguredAgentConnection { locator: string; endpoint: string; usage: 'runtime' | 'builder'; targetKey?: string }
export interface ProjectAgentConnections {
  connections: ConfiguredAgentConnection[];
  dynamicBuilder?: { provider: string; region?: string; zone?: string; instanceType?: string };
}
export interface AgentConnectionCheck {
  ok: boolean; checkedAt: string; version?: string; machineRole?: AgentRole; accessRole?: AgentRole;
  docker?: boolean; error?: string;
}

function config(input: ProjectInput): ShipConfig {
  try { return loadConfig(input.configPath); }
  catch { throw new Error('项目配置无法读取或校验失败，请在本机检查配置引用'); }
}

function entries(value: ShipConfig): Array<{ locator: string; target: TargetConfig; usage: 'runtime' | 'builder'; targetKey?: string }> {
  const targets = Object.entries(value.runtime.targets).map(([targetKey, target]) => ({ locator: `runtime:${targetKey}`, target, usage: 'runtime' as const, targetKey }));
  return value.builder.static ? [...targets, { locator: 'builder:static', target: value.builder.static, usage: 'builder' }] : targets;
}

export async function listProjectAgentConnections(input: ProjectInput): Promise<ProjectAgentConnections> {
  const value = config(input);
  const connections = entries(value).map(({ locator, target, usage, targetKey }) => ({ locator, endpoint: publicUrl(target.url), usage, targetKey }));
  const dynamic = value.builder.dynamic;
  return { connections, ...(dynamic ? { dynamicBuilder: { provider: dynamic.provider, region: dynamic.tencent?.region, zone: dynamic.tencent?.zone, instanceType: dynamic.tencent?.instanceType } } : {}) };
}

function role(value: unknown): AgentRole | undefined { return ['builder', 'runtime', 'both'].includes(String(value)) ? value as AgentRole : undefined; }
function compatible(actual: AgentRole | undefined, expected: 'runtime' | 'builder'): boolean { return actual === 'both' || actual === expected; }

export async function checkProjectAgentConnection(input: ProjectInput, locator: string, expectedEndpoint?: string): Promise<AgentConnectionCheck> {
  const checkedAt = new Date().toISOString();
  const entry = entries(config(input)).find(item => item.locator === locator);
  if (!entry) return { ok: false, checkedAt, error: '该连接已从项目配置中移除，请刷新资源清单' };
  if (expectedEndpoint && publicUrl(entry.target.url) !== expectedEndpoint) return { ok: false, checkedAt, error: '连接端点已变更，请刷新资源清单后重新检查' };
  let target: Awaited<ReturnType<typeof resolveTargetToken>>;
  try { target = await resolveTargetToken(entry.target); }
  catch { return { ok: false, checkedAt, error: '连接凭据无法解析，请在本机检查凭据引用' }; }
  try {
    const status = await api<AgentStatus>(target.url, target.token, 'GET', '/api/status', undefined, 8_000, target);
    const machineRole = role(status?.role);
    const accessRole = role(status?.auth?.role);
    const docker = typeof status?.docker === 'boolean' ? status.docker : undefined;
    const version = typeof status?.version === 'string' && status.version.length <= 80 && /^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(status.version) ? status.version : undefined;
    const matched = compatible(machineRole, entry.usage) && compatible(accessRole, entry.usage);
    return { ok: matched && docker === true, checkedAt, machineRole, accessRole, version, docker,
      ...(!matched ? { error: 'Agent 实际角色或凭据权限与配置用途不符' } : docker !== true ? { error: 'Agent 可连接，但 Docker 尚未确认可用' } : {}) };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return { ok: false, checkedAt, error: status === 401 || status === 403 ? '连接认证失败，请检查此项目的凭据' : status ? 'Agent 状态接口返回错误，请检查连接' : 'Agent 连接不可达，请检查服务或隧道' };
  }
}
