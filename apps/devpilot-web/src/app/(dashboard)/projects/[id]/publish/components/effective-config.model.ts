/**
 * 生效配置模型（纯函数，第 0 步发布向导）
 *
 * 单一职责：把「最新配置修订」三源数据合并为生效配置表行，并给出
 * 冲突键与未配置密钥（发布阻断项）。
 *
 * 冲突口径对齐后端 apps/devpilot-api/src/project-environment/environment-variable-ownership.model.ts
 * （三源 plain/secret/resource，同键多 owner 即冲突；后端的 scope 细分 —— 多 scope 且
 * 无 global 不算冲突 —— 在前端不适用，因为本表只评估单一环境的单一修订，等价于
 * 全部 owner 同处 global scope）。本文件不实现覆盖语义：冲突只能去解决（改自定义
 * 变量或调整资源绑定），与后端 409 策略一致。
 */

export type EffectiveConfigSourceKind = 'custom' | 'resource' | 'secret';

export interface EffectiveConfigSecretRefInput {
  id: string;
  name: string;
  targetEnvKey?: string | null;
}

export interface EffectiveConfigResourceInjection {
  key: string;
  /** 来源标签，形如「资源类型 / 实例名」。 */
  label: string;
}

export interface EffectiveConfigInput {
  plainVariables?: Record<string, string> | null;
  secretReferences?: EffectiveConfigSecretRefInput[] | null;
  /** 项目下已存在的密钥 ID 列表（用于「已配置/未配置」判定）。 */
  configuredSecretIds?: string[] | null;
  resourceInjections?: EffectiveConfigResourceInjection[] | null;
}

export interface EffectiveConfigRow {
  key: string;
  /** 该键的全部来源；长度 > 1 即冲突。 */
  sources: EffectiveConfigSourceKind[];
  /** 自定义来源的值（其他来源为 null，值不展示）。 */
  value: string | null;
  /** 资源注入来源的标签（如「MySQL / orders-db」）。 */
  fromLabel: string | null;
  /** 密钥来源状态；false = 在密钥列表中不可见（未配置或无权限），非密钥来源为 null。 */
  secretConfigured: boolean | null;
  conflict: boolean;
}

export interface EffectiveConfigConflict {
  key: string;
  sources: EffectiveConfigSourceKind[];
}

/** 密钥引用在项目密钥列表中不可见（未配置或无权限）—— 警告项，不阻断发布。 */
export interface UnknownSecretRow {
  key: string;
  name: string;
}

export interface EffectiveConfigSummary {
  rows: EffectiveConfigRow[];
  conflicts: EffectiveConfigConflict[];
  unknownSecrets: UnknownSecretRow[];
  totalCount: number;
}

interface OwnerEntry {
  key: string;
  source: EffectiveConfigSourceKind;
  reference: string;
}

/**
 * 从资源类型 envTemplate 文本提取会注入的 KEY 名（每行 KEY=... 的左侧）。
 * 实现收敛在 [id]/utils/template-keys.utils.ts（部署注入第一源的唯一实现），
 * 此处 re-export 仅为兼容本目录既有引用。
 */
export { deriveTemplateKeys } from '../../utils/template-keys.utils';

/** 与后端 exportAsEnv 同源的密钥 KEY 派生（name 转大写下划线）。 */
export function deriveSecretEnvKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/** 合并三源变量并计算冲突与未配置密钥。纯函数，无副作用。 */
export function buildEffectiveConfigSummary(input: EffectiveConfigInput): EffectiveConfigSummary {
  const owners: OwnerEntry[] = [];
  const plainValues = new Map<string, string>();
  for (const [key, value] of Object.entries(input.plainVariables ?? {})) {
    owners.push({ key, source: 'custom', reference: 'plain' });
    plainValues.set(key, value);
  }

  const configured = new Set(input.configuredSecretIds ?? []);
  const secretConfiguredByKey = new Map<string, boolean>();
  const secretNameByKey = new Map<string, string>();
  for (const reference of input.secretReferences ?? []) {
    const key = reference.targetEnvKey?.trim() || deriveSecretEnvKey(reference.name);
    owners.push({ key, source: 'secret', reference: reference.id });
    const configuredNow = configured.has(reference.id);
    const prior = secretConfiguredByKey.get(key);
    secretConfiguredByKey.set(key, prior === undefined ? configuredNow : prior && configuredNow);
    if (!secretNameByKey.has(key)) secretNameByKey.set(key, reference.name);
  }

  const resourceLabelByKey = new Map<string, string>();
  for (const injection of input.resourceInjections ?? []) {
    owners.push({ key: injection.key, source: 'resource', reference: injection.label });
    if (!resourceLabelByKey.has(injection.key)) {
      resourceLabelByKey.set(injection.key, injection.label);
    }
  }

  const conflicts = findConflicts(owners);
  const conflictKeys = new Set(conflicts.map((conflict) => conflict.key));

  const rows: EffectiveConfigRow[] = [...new Set(owners.map((owner) => owner.key))]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const keyOwners = owners.filter((owner) => owner.key === key);
      const sources = [...new Set(keyOwners.map((owner) => owner.source))];
      const hasCustom = sources.includes('custom');
      const hasResource = sources.includes('resource');
      const hasSecret = sources.includes('secret');
      return {
        key,
        sources,
        value: hasCustom ? (plainValues.get(key) ?? '') : null,
        fromLabel: hasResource ? (resourceLabelByKey.get(key) ?? '') : null,
        secretConfigured: hasSecret ? secretConfiguredByKey.get(key) === true : null,
        conflict: conflictKeys.has(key),
      };
    });

  const unknownSecrets = rows
    .filter((row) => row.secretConfigured === false)
    .map((row) => ({ key: row.key, name: secretNameByKey.get(row.key) ?? row.key }));

  return { rows, conflicts, unknownSecrets, totalCount: rows.length };
}

/** 与后端 findEnvironmentVariableCollisions 同口径：同键 owner 数 > 1 即冲突。 */
function findConflicts(owners: OwnerEntry[]): EffectiveConfigConflict[] {
  return [...new Set(owners.map((owner) => owner.key))]
    .map((key) => {
      const keyOwners = owners.filter((owner) => owner.key === key);
      return {
        key,
        owners: keyOwners,
        sources: [...new Set(keyOwners.map((owner) => owner.source))],
      };
    })
    .filter((collision) => collision.owners.length > 1)
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((collision) => ({ key: collision.key, sources: collision.sources }));
}
