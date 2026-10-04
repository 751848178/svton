// Read-only connection checks for `ship init`. Three clearly separated levels per target:
// 入口可达 (/health, no auth) → 认证成功 (/api/status with token) → 凭据有效权限与 Docker 匹配.
// The role level uses the status endpoint's `auth` report of the CALLER's effective
// role (M2-04) — the machine role (=both on combined machines) is display-only and
// must never be read as a credential permission.
// Registry check only proves reachability of /v2/ — push/pull is NOT verified from the
// controller (credentials live on the agents; real push/pull is UX07/M2).

import { api, ApiError } from '../../shared/http.js';

export interface AgentCheckResult {
  kind: 'builder' | 'runtime';
  url: string;
  reachable: boolean;
  authenticated: boolean;
  roleOk: boolean;
  dockerOk: boolean;
  passed: boolean;
  detail: string;
}

export interface RegistryCheckResult {
  url: string;
  reachable: boolean;
  scheme: 'https' | 'http' | null;
  httpStatus: number | null;
  detail: string;
}

interface StatusBody {
  role?: string;
  version?: string;
  docker?: boolean;
  auth?: { role?: string; capabilities?: string[] };
}

export async function checkAgent(
  kind: 'builder' | 'runtime',
  url: string,
  token: string,
  caFile?: string,
): Promise<AgentCheckResult> {
  const res: AgentCheckResult = { kind, url, reachable: false, authenticated: false, roleOk: false, dockerOk: false, passed: false, detail: '' };
  try {
    // M2-R3: the health probe must use the SAME trust source as the authenticated
    // calls — a CA-pinned entry cannot be probed with system trust alone
    const health = await api<{ role?: string; version?: string }>(url, undefined, 'GET', '/health', undefined, 6000, caFile ? { caFile } : {});
    res.reachable = true;
    res.detail = `入口可达 v${health?.version ?? '?'} role=${health?.role ?? '?'}`;
  } catch (e) {
    res.detail = `入口不可达（/health）：${(e as Error).message}`;
    return res;
  }
  try {
    const status = await api<StatusBody>(url, token, 'GET', '/api/status', undefined, 8000, caFile ? { caFile } : {});
    res.authenticated = true;
    const effective = status?.auth?.role;
    if (!status?.auth || !effective) {
      res.detail = `${res.detail}；认证成功，但该 agent 未上报调用凭据的有效权限（需 ship-agent ≥0.5.0；机器角色 ${status?.role ?? '?'} 不能当作凭据权限）`;
    } else if (effective === kind || effective === 'both') {
      res.roleOk = true;
      res.detail = `${res.detail}；凭据有效角色 ${effective} ✓`;
    } else {
      res.detail = `${res.detail}；凭据有效角色是 ${effective}，需要 ${kind}（机器角色 ${status?.role ?? '?'} 不代表凭据权限）`;
    }
    res.dockerOk = Boolean(status?.docker);
    res.detail = res.dockerOk ? `${res.detail}；Docker 可用 ✓` : `${res.detail}；Docker 不可用`;
  } catch (e) {
    const hint = e instanceof ApiError && e.status === 401
      ? 'token 无效或已过期'
      : e instanceof ApiError && e.status === 403
        ? `token 有效但无 ${kind} 权限`
        : (e as Error).message;
    res.detail = `${res.detail}；认证失败：${hint}`;
    return res;
  }
  res.passed = res.reachable && res.authenticated && res.roleOk && res.dockerOk;
  return res;
}

async function probeV2(scheme: 'https' | 'http', host: string): Promise<number | null> {
  try {
    const res = await fetch(`${scheme}://${host}/v2/`, { signal: AbortSignal.timeout(5000) });
    return res.status;
  } catch {
    return null;
  }
}

export async function checkRegistry(url: string): Promise<RegistryCheckResult> {
  const res: RegistryCheckResult = { url, reachable: false, scheme: null, httpStatus: null, detail: '' };
  for (const scheme of ['https', 'http'] as const) {
    const status = await probeV2(scheme, url);
    if (status !== null) {
      res.reachable = true;
      res.scheme = scheme;
      res.httpStatus = status;
      res.detail = `地址可达（${scheme}:///v2/ → HTTP ${status}${status === 200 || status === 401 ? '' : '，非标准 Registry 响应'}）；认证与推拉不在控制器侧验证（凭证在 agent 机器上，真实推拉实测属于下一阶段）`;
      return res;
    }
  }
  res.detail = `地址不可达（https/http 均无法连接 /v2/）——不影响保存配置，但首次构建推送会失败`;
  return res;
}
