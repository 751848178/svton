'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const PROJECT_TABS = new Set([
  'overview',
  'deployments',
  'releases',
  'environments',
  'webhooks',
  'resources',
  'settings',
]);

/** 让项目详情 Tab 可通过 URL 恢复、分享和返回。 */
export function useProjectDetailTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab') ?? '';
  const activeKey = PROJECT_TABS.has(queryTab) ? queryTab : 'overview';

  const setActiveKey = useCallback(
    (tab: string) => {
      if (!PROJECT_TABS.has(tab)) return;
      const next = new URLSearchParams(searchParams.toString());
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { activeKey, setActiveKey };
}
