/**
 * Site takeover state/actions.
 *
 * Owns focused-site selection, takeover binding form state, and preview
 * activation while the parent hook keeps site list loading and shared plans.
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { Site, SiteSyncPlan, SiteTakeoverForm } from '../types';
import { buildSiteTakeoverTls, createSiteTakeoverForm } from '../utils-takeover';

interface UseSiteTakeoverArgs {
  sites: Site[];
  siteId: string;
  queueSiteRuns: boolean;
  setSites: Dispatch<SetStateAction<Site[]>>;
  setPlans: Dispatch<SetStateAction<Record<string, SiteSyncPlan>>>;
  refreshSyncRuns: (id: string) => Promise<void>;
}

export function useSiteTakeover(args: UseSiteTakeoverArgs) {
  const { sites, siteId, queueSiteRuns, setSites, setPlans, refreshSyncRuns } = args;
  const [focusedSiteId, setFocusedSiteId] = useState(siteId);
  const [takeoverForms, setTakeoverForms] = useState<Record<string, SiteTakeoverForm>>({});
  const [savingTakeoverId, setSavingTakeoverId] = useState<string | null>(null);
  const [activatingPreviewId, setActivatingPreviewId] = useState<string | null>(null);

  useEffect(() => {
    setFocusedSiteId(siteId);
  }, [siteId]);

  const focusedSite = focusedSiteId ? sites.find((s) => s.id === focusedSiteId) || null : null;

  useEffect(() => {
    if (!focusedSite) return;
    setTakeoverForms((cur) =>
      cur[focusedSite.id] ? cur : { ...cur, [focusedSite.id]: createSiteTakeoverForm(focusedSite) },
    );
  }, [focusedSite]);

  const updateFocusedTakeoverForm = usePersistFn((patch: Partial<SiteTakeoverForm>) => {
    if (!focusedSite) return;
    setTakeoverForms((cur) => ({
      ...cur,
      [focusedSite.id]: {
        ...createSiteTakeoverForm(focusedSite),
        ...cur[focusedSite.id],
        ...patch,
      },
    }));
  });

  const handleSaveTakeoverBinding = usePersistFn(async (site: Site) => {
    const form = takeoverForms[site.id] || createSiteTakeoverForm(site);
    setSavingTakeoverId(site.id);
    try {
      const updated = await apiRequest<Site>(`PUT:/sites/${site.id}`, {
        serverId: form.serverId,
        tls: buildSiteTakeoverTls(site, form),
        status: site.status,
      });
      setSites((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
      setTakeoverForms((cur) => ({ ...cur, [updated.id]: createSiteTakeoverForm(updated) }));
      alert('已保存站点接管绑定');
    } catch (error) {
      console.error('Failed to save site takeover binding:', error);
      alert(error instanceof Error ? error.message : '保存站点接管绑定失败');
    } finally {
      setSavingTakeoverId(null);
    }
  });

  const handleActivatePreviewSite = usePersistFn(async (site: Site) => {
    const form = takeoverForms[site.id] || createSiteTakeoverForm(site);
    if (!form.serverId) {
      alert('请先选择目标服务器');
      return;
    }
    if (!form.upstreamUrl.trim()) {
      alert('请填写预览上游地址');
      return;
    }
    setActivatingPreviewId(site.id);
    try {
      const result = await apiRequest<{ site: Site; syncPlan?: SiteSyncPlan }>(
        `POST:/sites/${site.id}/preview-takeover`,
        {
          serverId: form.serverId,
          upstreamUrl: form.upstreamUrl.trim(),
          websocket: form.websocket,
          tls: buildSiteTakeoverTls(site, form),
          createDryRunPlan: true,
          queue: queueSiteRuns,
        },
      );
      setSites((cur) => cur.map((i) => (i.id === result.site.id ? result.site : i)));
      setTakeoverForms((cur) => ({
        ...cur,
        [result.site.id]: createSiteTakeoverForm(result.site),
      }));
      if (result.syncPlan) setPlans((cur) => ({ ...cur, [site.id]: result.syncPlan! }));
      await refreshSyncRuns(site.id);
    } catch (error) {
      console.error('Failed to activate preview site takeover:', error);
      alert(error instanceof Error ? error.message : '接管预览站点失败');
    } finally {
      setActivatingPreviewId(null);
    }
  });

  return {
    focusedSiteId,
    setFocusedSiteId,
    takeoverForms,
    savingTakeoverId,
    activatingPreviewId,
    focusedSite,
    updateFocusedTakeoverForm,
    handleSaveTakeoverBinding,
    handleActivatePreviewSite,
  };
}
