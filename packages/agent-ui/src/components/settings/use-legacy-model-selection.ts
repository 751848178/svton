import { useMemo, useState } from 'react';
import type { ISettingsAdapter, ProviderInfo } from './SettingsView';
import type { ModelSelectionControl } from '../models/model-selection.types';
import { useI18n } from '@svton/ui';

export function useLegacyModelSelection(
  adapter: ISettingsAdapter,
  providers: ProviderInfo[],
  defaultModel: string,
  setDefaultModel: (value: string) => void,
): ModelSelectionControl {
  const { translate: t } = useI18n();
  const [message, setMessage] = useState<string>();
  const [phase, setPhase] = useState<'idle' | 'succeeded' | 'failed'>('idle');
  const options = useMemo(() => providers.flatMap((provider) =>
    provider.models.map((model) => {
      const value = JSON.stringify({ providerId: provider.id, modelId: model.id });
      return {
        value,
        modelName: model.name || model.id,
        providerName: provider.name || provider.id,
        providerId: provider.id,
        accessibleName: `${model.name || model.id} — ${provider.name || provider.id} (${provider.id})`,
        hiddenCurrent: false,
        removedCurrent: false,
        bootstrap: false,
      };
    })), [providers]);
  const selected = options.find((option) => option.value === defaultModel);
  const label = selected?.accessibleName ?? defaultModel;
  return {
    options,
    activeValue: defaultModel,
    persistedValue: defaultModel,
    phase,
    message,
    activeLabel: label,
    persistedLabel: label,
    canRetryPersistence: false,
    select: async (value) => {
      try {
        await adapter.setDefaultModel(value);
        setDefaultModel(value);
        setPhase('succeeded');
        setMessage(t('settings.model.defaultSaved', {
          model: options.find((option) => option.value === value)?.accessibleName ?? value,
        }));
      } catch (error) {
        setPhase('failed');
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    retryPersistence: () => {},
    dismissResult: () => {
      setPhase('idle');
      setMessage(undefined);
    },
  };
}
