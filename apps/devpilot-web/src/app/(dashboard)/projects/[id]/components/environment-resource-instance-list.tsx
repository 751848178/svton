/**
 * 资源交付实例列表（只读）
 *
 * 单一职责：渲染绑定到当前 environment 的资源实例，展示实例名、类型、注入的 KEY 名。
 * 注入 KEY 名从 resourceType.envTemplate 文本提取（部署注入的第一源）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { isResourceTypeInjectable } from '../utils/injectable-resource-types';
import { deriveTemplateKeys } from '../utils/template-keys.utils';
import type { ProjectResourceInstance } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentResourceInstanceListProps {
  instances: ProjectResourceInstance[];
  t: ProjectsTranslator;
}

export function EnvironmentResourceInstanceList({
  instances,
  t,
}: EnvironmentResourceInstanceListProps) {
  return (
    <div className="space-y-1">
      <h5 className="text-xs font-medium text-muted-foreground">{t('envVarsInstanceTitle')}</h5>
      <p className="text-xs text-muted-foreground">{t('envVarsInstanceHint')}</p>
      {instances.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('envVarsInstanceEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {instances.map((inst) => {
            const injectable = isResourceTypeInjectable(inst.resourceType?.key);
            const keys = deriveTemplateKeys(inst.resourceType?.envTemplate);
            return (
              <li key={inst.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">{inst.name}</span>
                <span className="text-xs text-muted-foreground">
                  {inst.resourceType?.name || inst.resourceType?.key}
                </span>
                {injectable && keys.length > 0 ? (
                  <span className="font-mono text-xs text-primary">→ {keys.join(', ')}</span>
                ) : injectable ? (
                  <span className="text-xs text-muted-foreground">→ (按模板注入)</span>
                ) : (
                  <span className="text-xs text-muted-foreground">(无 envTemplate,不注入)</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
