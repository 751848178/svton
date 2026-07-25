/**
 * 密钥变量列表（只读）
 *
 * 单一职责：渲染绑定到当前 environment 的密钥 KEY（值永不展示），并提供「管理密钥」深链。
 * 密钥值绝不在此展示；仅展示派生 KEY 名 + 类型 + 掩码。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectSecretKey } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentSecretVarsListProps {
  secretKeys: ProjectSecretKey[];
  keysManageHref: string;
  t: ProjectsTranslator;
}

/** 与后端 exportAsEnv 同源的 KEY 名派生（name.toUpperCase().replace(/[^A-Z0-9]/g, '_')）。 */
function deriveEnvKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

export function EnvironmentSecretVarsList({
  secretKeys,
  keysManageHref,
  t,
}: EnvironmentSecretVarsListProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium text-muted-foreground">{t('envVarsSecretTitle')}</h5>
        <Link href={keysManageHref} className="text-xs text-primary hover:underline">
          {t('envVarsManageKeys')}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">{t('envVarsSecretHint')}</p>
      {secretKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('envVarsSecretEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {secretKeys.map((sk) => (
            <li key={sk.id} className="flex items-center gap-2">
              <span className="font-mono text-xs">{deriveEnvKey(sk.name)}</span>
              <span className="text-xs text-muted-foreground">{sk.type}</span>
              <span className="font-mono text-xs text-muted-foreground">••••••••</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
