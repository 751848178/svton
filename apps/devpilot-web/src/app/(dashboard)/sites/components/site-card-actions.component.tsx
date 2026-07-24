/** Site card action buttons: 主操作 + 次操作 + 分组菜单（与聚焦面板共用 utils-actions 定义）。 */
'use client';

import { useTranslations } from 'next-intl';
import { ActionMenu } from '@/components/ui/action-menu';
import type { useSites } from '../hooks/use-sites';
import type { Site } from '../types';
import { buildSiteActionGroups } from '../utils-actions';

type SitesHook = ReturnType<typeof useSites>;

interface SiteCardActionsProps {
  site: Site;
  sites: SitesHook;
  canRenewTls: boolean;
}

export function SiteCardActions({ site, sites, canRenewTls }: SiteCardActionsProps) {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
  const actions = buildSiteActionGroups({ t, tc, site, sites, canRenewTls, includeDelete: true });
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={actions.primary.onSelect}
        disabled={actions.primary.disabled}
        className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {actions.primary.label}
      </button>
      <button
        onClick={() => sites.setEditTarget(site)}
        className="min-h-11 rounded-md border px-3 text-sm font-medium hover:bg-accent"
      >
        {t('editSite')}
      </button>
      <button
        onClick={actions.secondary.onSelect}
        disabled={actions.secondary.disabled}
        className="min-h-11 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {actions.secondary.label}
      </button>
      <ActionMenu groups={actions.menuGroups} triggerLabel={t('moreActions')} />
    </div>
  );
}
