import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@svton/ui';
import type { ISettingsAdapter } from '../settings-adapter.types';
import type { MarketplaceSkill } from '../settings-data.types';

export function useMarketplaceSection(adapter: ISettingsAdapter, onReload: () => void) {
  const { translate: t } = useI18n();
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'trending' | 'all-time' | 'hot'>('trending');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const loadSkills = useCallback(async (options?: { query?: string; view?: string; page?: number }) => {
    setLoading(true); setError(null);
    try {
      if (options?.query) {
        const results = await adapter.searchMarketplace!(options.query);
        setSkills(results); setTotal(results.length);
      } else {
        const result = await adapter.browseMarketplace!({
          view: options?.view || viewMode, page: options?.page ?? page,
        });
        setSkills(result.skills); setTotal(result.total);
      }
    } catch {
      setError(t('settings.marketplace.loadFailure'));
    } finally {
      setLoading(false);
    }
  }, [adapter, page, t, viewMode]);
  useEffect(() => { void loadSkills(); }, []);
  const search = () => {
    setPage(0);
    void loadSkills(searchQuery.trim()
      ? { query: searchQuery.trim() }
      : { view: viewMode, page: 0 });
  };
  const changeView = (view: typeof viewMode) => {
    setViewMode(view); setPage(0); setSearchQuery('');
    void loadSkills({ view, page: 0 });
  };
  const install = async (skillId: string) => {
    if (!adapter.installFromMarketplace) return;
    setInstallingId(skillId); setInstallStatus(null);
    try {
      const result = await adapter.installFromMarketplace(skillId);
      if (!result.success) throw new Error('marketplace install failed');
      setInstallStatus({ kind: 'success', message: t('settings.marketplace.installSuccess') });
      onReload();
      setSkills((current) => current.map((skill) => skill.id === skillId
        ? { ...skill, installed: true } : skill));
    } catch {
      setInstallStatus({ kind: 'error', message: t('settings.marketplace.installFailure', { message: t('status.failed') }) });
    } finally {
      setInstallingId(null);
    }
  };
  const changePage = (next: number) => {
    const bounded = Math.max(0, next);
    setPage(bounded); void loadSkills({ view: viewMode, page: bounded });
  };
  return {
    changePage, changeView, error, install, installingId, installStatus,
    loading, page, search, searchQuery, setSearchQuery, skills, total, viewMode,
  };
}
