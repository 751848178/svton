/**
 * 环境普通环境变量（KEY=VALUE）CRUD Hook
 *
 * 单一职责：维护 ProjectEnvironment.config.envVars 这一份普通变量表。
 *   - 读取：从传入 environment 的 config.envVars 派生（无独立请求）。
 *   - 写入：PUT /project-environments/:id，payload 为 { config: { ...existing, envVars } }。
 *
 * 与「密钥变量」（密钥中心 SecretKey）解耦：本 Hook 只管非敏感的普通变量，
 * 敏感值请走密钥中心（/keys）。
 *
 * 安全：普通变量按设计为非敏感（用户自行分类），仍不在日志中打印完整值。
 */

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ProjectEnvironment } from '../types';

/** KEY 必须匹配 ^[A-Z_][A-Z0-9_]*$（与后端 resolveDeploymentEnvVars 过滤一致）。 */
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export function isValidEnvKey(key: string): boolean {
  return ENV_KEY_PATTERN.test(key);
}

/** 从 environment.config.envVars 安全派生普通变量表（保证返回对象）。 */
export function readEnvVars(environment: ProjectEnvironment | null): Record<string, string> {
  const envVars = environment?.config?.envVars;
  if (!envVars || typeof envVars !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(envVars)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export interface UseEnvironmentEnvVarsResult {
  vars: Record<string, string>;
  /** 本地编辑缓冲（add/edit/delete 命中缓冲；save 落库 + 回调通知父级）。 */
  draft: Record<string, string>;
  setDraft: (next: Record<string, string>) => void;
  saving: boolean;
  save: () => Promise<void>;
  reset: () => void;
}

export function useEnvironmentEnvVars(
  environment: ProjectEnvironment | null,
  onSaved: (updated: ProjectEnvironment) => void,
): UseEnvironmentEnvVarsResult {
  const vars = readEnvVars(environment);
  const [draft, setDraftState] = useState<Record<string, string>>(vars);
  const [saving, setSaving] = useState(false);

  // environment 切换时重置 draft 为该环境的落库值。
  const setDraft = useCallback(
    (next: Record<string, string>) => setDraftState(next),
    [],
  );

  const reset = useCallback(() => setDraftState(vars), [vars]);

  const save = useCallback(async () => {
    if (!environment) return;
    // 校验：仅保留符合后端注入规则 ^[A-Z_][A-Z0-9_]*$ 的 KEY,
    // 避免无效 KEY 落库后在部署时被静默丢弃(架构师 L2)。
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (isValidEnvKey(k)) cleaned[k] = v;
    }
    setSaving(true);
    try {
      // 合并：保留 config 中其它键，仅替换 envVars。
      const existingConfig =
        environment.config && typeof environment.config === 'object'
          ? { ...environment.config }
          : {};
      const config = { ...existingConfig, envVars: cleaned };
      const updated = await apiRequest<ProjectEnvironment>(
        `PUT:/project-environments/${environment.id}`,
        { config },
      );
      onSaved({ ...environment, config: updated?.config ?? config });
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [environment, draft, onSaved]);

  return { vars, draft, setDraft, saving, save, reset };
}
