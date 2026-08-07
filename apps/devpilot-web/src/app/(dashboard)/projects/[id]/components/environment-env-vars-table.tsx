/**
 * 变量与密钥六列表（Demo 对齐，AC-SET-041）
 *
 * 单一职责：把当前环境「普通变量（环境值）+ Secret 引用（密钥引用）+ 资源
 * 实例注入（资源绑定生成）」三类条目渲染为 Demo 六列只读表格：
 * 键 / 组件作用域 / 来源 / 环境值·引用 / 要求 / 校验。
 *
 * 诚实数据约束：Secret 引用只展示 id/name/type 派生的 vault 形式掩码，绝不
 * 显示密钥明文；来源值严格使用 环境值/密钥引用/资源绑定生成 三分类。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export interface EnvVarsTableSecretRef {
  id: string;
  name: string;
  type: string;
}

export interface EnvVarsTableResourceInjection {
  key: string;
  label: string;
}

interface EnvironmentEnvVarsTableProps {
  plainVars: Record<string, string>;
  secretRefs: EnvVarsTableSecretRef[];
  /** 是否已进入当前生效修订（未进入的引用标记 待生效）。 */
  committedSecretIds: Set<string>;
  resourceInjections: EnvVarsTableResourceInjection[];
  t: ProjectsTranslator;
}

const HEADER_KEYS = [
  'envVarsTableKey',
  'envVarsTableScope',
  'envVarsTableSource',
  'envVarsTableValue',
  'envVarsTableRequirement',
  'envVarsTableValidation',
] as const;

const VALIDATION_PILL_CLASSES: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  invalid: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

type Row = {
  key: string;
  scopeKey: string;
  sourceKey: string;
  valueLabel: string;
  requirementKey: string;
  validationKey: string;
  validationTone: 'valid' | 'invalid' | 'pending';
};

export function EnvironmentEnvVarsTable({
  plainVars,
  secretRefs,
  committedSecretIds,
  resourceInjections,
  t,
}: EnvironmentEnvVarsTableProps) {
  const rows: Row[] = buildRows(plainVars, secretRefs, committedSecretIds, resourceInjections);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('envVarsTableEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {HEADER_KEYS.map((key) => (
              <th key={key} className="py-2 pr-3 font-medium">{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.sourceKey}:${row.key}`} className="border-b last:border-0">
              <td className="py-2 pr-3 font-mono text-xs">{row.key}</td>
              <td className="py-2 pr-3 text-xs text-muted-foreground">{t(row.scopeKey)}</td>
              <td className="py-2 pr-3 text-xs">{t(row.sourceKey)}</td>
              <td className="max-w-[260px] truncate py-2 pr-3 font-mono text-xs">
                {row.valueLabel}
              </td>
              <td className="py-2 pr-3 text-xs">
                <span
                  className={
                    row.requirementKey === 'envVarsRequirementSensitive'
                      ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : undefined
                  }
                >
                  {t(row.requirementKey)}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${VALIDATION_PILL_CLASSES[row.validationTone]}`}
                >
                  {t(row.validationKey)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildRows(
  plainVars: Record<string, string>,
  secretRefs: EnvVarsTableSecretRef[],
  committedSecretIds: Set<string>,
  resourceInjections: EnvVarsTableResourceInjection[],
): Row[] {
  const rows: Row[] = [];
  for (const [key, value] of Object.entries(plainVars).sort()) {
    const valid = /^[A-Z_][A-Z0-9_]*$/.test(key);
    rows.push({
      key,
      scopeKey: 'envVarsScopeEnv',
      sourceKey: 'envVarsSourcePlain',
      valueLabel: value === '' ? '(empty)' : value,
      requirementKey: 'envVarsRequirementOptional',
      validationKey: valid ? 'envVarsValidationValid' : 'envVarsValidationInvalid',
      validationTone: valid ? 'valid' : 'invalid',
    });
  }
  for (const ref of [...secretRefs].sort((a, b) => a.name.localeCompare(b.name))) {
    const committed = committedSecretIds.has(ref.id);
    rows.push({
      key: ref.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      scopeKey: 'envVarsScopeEnv',
      sourceKey: 'envVarsSourceSecret',
      valueLabel: `vault://${ref.name}@${ref.id.slice(0, 8)} · ••••••••`,
      requirementKey: 'envVarsRequirementSensitive',
      validationKey: committed ? 'envVarsValidationValid' : 'envVarsValidationPending',
      validationTone: committed ? 'valid' : 'pending',
    });
  }
  for (const injection of [...resourceInjections].sort((a, b) => a.key.localeCompare(b.key))) {
    rows.push({
      key: injection.key,
      scopeKey: 'envVarsScopeEnv',
      sourceKey: 'envVarsSourceResource',
      valueLabel: injection.label,
      requirementKey: 'envVarsRequirementRequired',
      validationKey: 'envVarsValidationValid',
      validationTone: 'valid',
    });
  }
  return rows;
}
