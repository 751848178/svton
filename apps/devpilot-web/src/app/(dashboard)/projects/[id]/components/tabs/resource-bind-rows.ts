/**
 * 资源绑定卡片 - 行构建（纯函数）
 *
 * 单一职责：从 Project 构造「可绑定资源行」，并按「是否会部署注入」分组。
 *
 * 事实（见 research/r2-issue234 §1.2）：
 * - 后端 resolveDeploymentEnvVars 只查 prisma.resourceInstance；
 * - 只有 resourceType.envTemplate 非空的 resourceInstance 才会被注入 .env；
 * - managedResource / secretKey / site / cdnConfig 绑定到环境后对部署变量零影响，仅作归类。
 *
 * 把这两类行明确分离，避免用户误以为勾选任意资源都会进 .env。
 */

import type { Project } from '../../types';
import type { EnvironmentResourceBulkBindSelectionKey } from '../../types/environment-copy';
import { isResourceTypeInjectable } from '../../utils/injectable-resource-types';

/** 行的「注入语义」分组。 */
export type BindableRowGroup = 'inject' | 'categorical';

export interface BindableRow {
  id: string;
  name: string;
  /** 资源类型 display 名（如 MySQL / 托管资源 / 站点 / 密钥）。 */
  typeName: string;
  /** 该资源绑定到环境后是否会被部署注入 .env。 */
  group: BindableRowGroup;
  /** 该 resourceType 会注入的变量 KEY 预告（仅 group==='inject' 且有 envTemplate 时）。 */
  injectKeysPreview?: string;
  selectionKey: EnvironmentResourceBulkBindSelectionKey;
}

/** 项目级（未按环境过滤）的 resource_instance，凡资源类型拥有 envTemplate 即视为可注入。 */
function buildInstanceRows(p: Project): BindableRow[] {
  return (p.resourceInstances || []).map((i) => {
    const typeKey = i.resourceType?.key ?? null;
    const injectable = isResourceTypeInjectable(typeKey);
    return {
      id: i.id,
      name: i.name || i.id,
      typeName: i.resourceType?.name || typeKey || 'resource_instance',
      group: injectable ? 'inject' : 'categorical',
      injectKeysPreview: injectable
        ? parseEnvTemplateKeys(i.resourceType?.envTemplate)
        : undefined,
      selectionKey: 'resourceInstanceIds',
    };
  });
}

/** 其余 4 类资源（托管/站点/密钥/CDN）——绑定后仅归类、不注入。 */
function buildCategoricalRows(p: Project): BindableRow[] {
  const rows: BindableRow[] = [];
  (p.managedResources || []).forEach((r) =>
    rows.push({
      id: r.id,
      name: r.name || r.id,
      typeName: r.provider ? `${r.provider}/${r.kind}` : r.kind,
      group: 'categorical',
      selectionKey: 'managedResourceIds',
    }),
  );
  (p.sites || []).forEach((s) =>
    rows.push({
      id: s.id,
      name: s.name || s.primaryDomain || s.id,
      typeName: 'site',
      group: 'categorical',
      selectionKey: 'siteIds',
    }),
  );
  (p.secretKeys || []).forEach((s) =>
    rows.push({
      id: s.id,
      name: s.name || s.id,
      typeName: s.type ? `secret/${s.type}` : 'secret_key',
      group: 'categorical',
      selectionKey: 'secretKeyIds',
    }),
  );
  (p.cdnConfigs || []).forEach((c) =>
    rows.push({
      id: c.id,
      name: c.name || c.domain || c.id,
      typeName: 'cdn_config',
      group: 'categorical',
      selectionKey: 'cdnConfigIds',
    }),
  );
  return rows;
}

/** 从 envTemplate（如 REDIS_HOST="${host}"\nREDIS_PORT="${port}"）解析出 KEY 名列表预览。 */
export function parseEnvTemplateKeys(envTemplate: string | null | undefined): string | undefined {
  if (!envTemplate) return undefined;
  const keys = new Set<string>();
  for (const line of envTemplate.split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  if (keys.size === 0) return undefined;
  const list = Array.from(keys).sort();
  return list.length > 3 ? `${list.slice(0, 3).join(', ')} …` : list.join(', ');
}

/** 从 Project 构造全部可绑定行（含 inject / categorical 两组）。 */
export function buildBindableRows(p: Project): BindableRow[] {
  return [...buildInstanceRows(p), ...buildCategoricalRows(p)];
}
