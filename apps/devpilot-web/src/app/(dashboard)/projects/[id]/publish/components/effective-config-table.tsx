/**
 * 生效配置表（第 0 步）
 *
 * 单一职责：以「键 / 值(或状态) / 来源 / 操作」渲染合并后的生效配置行；
 * 来源徽标区分 自定义(可编辑)/资源注入(只读)/密钥(已配置·未配置)。
 * 冲突行高亮；解决入口链接到既有环境设置/密钥中心，不在本表内编辑。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EffectiveConfigRow } from './effective-config.model';

interface Props {
  rows: EffectiveConfigRow[];
  /** 深链：自定义变量编辑与资源绑定（既有环境设置入口）。 */
  variablesHref: string;
  resourcesHref: string;
  keysHref: string;
}

export function EffectiveConfigTable({ rows, variablesHref, resourcesHref, keysHref }: Props) {
  const t = useTranslations('projects');
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('publishConfigEmpty')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th
              scope="col"
              className="py-2 pr-3 font-medium"
            >
              {t('publishConfigKey')}
            </th>
            <th
              scope="col"
              className="py-2 pr-3 font-medium"
            >
              {t('publishConfigValue')}
            </th>
            <th
              scope="col"
              className="py-2 pr-3 font-medium"
            >
              {t('publishConfigSource')}
            </th>
            <th
              scope="col"
              className="py-2 font-medium"
            >
              {t('publishConfigActions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`border-b last:border-b-0 ${row.conflict ? 'bg-amber-500/10' : ''}`}
            >
              <td className="py-2 pr-3 font-mono text-xs">
                {row.key}
                {row.conflict ? (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {t('publishConflictBadge')}
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-3">{valueCell(row, t)}</td>
              <td className="py-2 pr-3">
                <span className="flex flex-wrap gap-1">
                  {row.sources.map((source) => (
                    <SourceBadge
                      key={source}
                      source={source}
                    />
                  ))}
                </span>
                {row.fromLabel ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t('publishFromResource', { resource: row.fromLabel })}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-xs">
                {actionCell(row, { variablesHref, resourcesHref, keysHref }, t)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function valueCell(row: EffectiveConfigRow, t: ReturnType<typeof useTranslations<'projects'>>) {
  if (row.secretConfigured === false) {
    return <span className="font-medium text-amber-700">{t('publishSecretUnconfigured')}</span>;
  }
  if (row.sources.includes('secret')) {
    return <span className="text-muted-foreground">{t('publishSecretConfigured')}</span>;
  }
  if (row.sources.includes('custom')) {
    return <span className="font-mono text-xs">{row.value || t('publishValueEmpty')}</span>;
  }
  return <span className="text-muted-foreground">{t('publishValueInjected')}</span>;
}

function actionCell(
  row: EffectiveConfigRow,
  hrefs: Pick<Props, 'variablesHref' | 'resourcesHref' | 'keysHref'>,
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  if (row.secretConfigured === false) {
    return (
      <Link
        href={hrefs.keysHref}
        className="text-primary hover:underline"
      >
        {t('publishSecretManage')}
      </Link>
    );
  }
  if (row.sources.includes('custom')) {
    return (
      <Link
        href={hrefs.variablesHref}
        className="text-primary hover:underline"
      >
        {t('publishActionEdit')}
      </Link>
    );
  }
  if (row.sources.includes('resource')) {
    return (
      <Link
        href={hrefs.resourcesHref}
        className="text-primary hover:underline"
      >
        {t('publishActionRebind')}
      </Link>
    );
  }
  return null;
}

export function SourceBadge({ source }: { source: EffectiveConfigRow['sources'][number] }) {
  const t = useTranslations('projects');
  const label =
    source === 'custom'
      ? t('publishSourceCustom')
      : source === 'resource'
        ? t('publishSourceResource')
        : t('publishSourceSecret');
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        source === 'custom'
          ? 'bg-indigo-500/10 text-indigo-700'
          : source === 'resource'
            ? 'bg-sky-500/10 text-sky-700'
            : 'bg-slate-500/10 text-slate-700'
      }`}
    >
      {label}
    </span>
  );
}
