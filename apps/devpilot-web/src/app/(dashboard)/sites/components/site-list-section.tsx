/**
 * 站点列表区
 *
 * 单一职责：渲染站点卡片网格，每卡片委托 SiteCard。
 */

import type { useSites } from '../hooks/use-sites';
import { SiteCard } from './site-card';

type SitesHook = ReturnType<typeof useSites>;

export function SiteListSection({ sites }: { sites: SitesHook }) {
  return (
    <div className="space-y-4">
      {sites.sites.map((site) => (
        <SiteCard
          key={site.id}
          site={site}
          sites={sites}
        />
      ))}
    </div>
  );
}
