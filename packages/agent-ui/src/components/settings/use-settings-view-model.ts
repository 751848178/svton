import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ISettingsAdapter } from './settings-adapter.types';
import { getSettingsSections, type SettingsSectionId } from './settings-navigation';
import { useAdapterState } from './use-adapter-state';
import { useI18n } from '@svton/ui';

export function useSettingsViewModel(adapter: ISettingsAdapter, refreshKey: number) {
  const { translate: t } = useI18n();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<'openai' | 'anthropic'>('openai');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  const [memoryInput, setMemoryInput] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'status' | 'alert'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = useAdapterState(adapter, refreshKey);
  const sections = useMemo(() => getSettingsSections(adapter, t), [adapter, t]);
  const providersChanged = useMemo(() => {
    const original = adapter.getProviders();
    if (state.providers.length !== original.length) return true;
    return state.providers.some((provider, index) => {
      const initial = original[index];
      return !initial || provider.name !== initial.name || provider.type !== initial.type
        || provider.baseUrl !== initial.baseUrl || provider.apiKey !== initial.apiKey
        || provider.models.length !== initial.models.length
        || provider.models.some((model, modelIndex) => (
          !initial.models[modelIndex]
          || model.id !== initial.models[modelIndex]?.id
          || model.name !== initial.models[modelIndex]?.name
        ));
    });
  }, [adapter, state.providers]);
  const showFeedback = useCallback((kind: 'status' | 'alert', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setFeedback({ kind, message });
    toastTimer.current = setTimeout(() => setFeedback(null), 3000);
  }, []);
  const showToast = useCallback((message: string) => showFeedback('status', message), [showFeedback]);
  const persist = useCallback(async (
    operation: () => void | Promise<void>,
    success: string,
    failure = t('settings.feedback.saveFailure'),
  ) => {
    try {
      await operation();
      showFeedback('status', success);
    } catch {
      showFeedback('alert', failure);
    }
  }, [showFeedback, t]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  return {
    activeSection, setActiveSection, showKey, setShowKey,
    showAddProvider, setShowAddProvider,
    newProviderName, setNewProviderName,
    newProviderType, setNewProviderType,
    newProviderUrl, setNewProviderUrl,
    memoryInput, setMemoryInput,
    feedback, showToast, showFeedback, persist, state, sections, providersChanged,
  };
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
