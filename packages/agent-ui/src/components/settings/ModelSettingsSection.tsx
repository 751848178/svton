import type { ModelSelectionControl } from '../models/model-selection.types';
import { ModelSelector } from '../models/ModelSelector';
import { useI18n } from '@svton/ui';

export function ModelSettingsSection({
  control,
}: {
  control: ModelSelectionControl;
}) {
  const { translate: t } = useI18n();
  return (
    <div className="mb-6 rounded-xl border border-[#383838] bg-[#2a2a2a] p-5">
      <h3 className="mb-4 text-sm font-medium text-gray-200">{t('settings.model.title')}</h3>
      <ModelSelector control={control} variant="settings" />
      <p className="mt-2 text-[10px] text-gray-600">
        {t('settings.model.description')}
      </p>
      {control.activeValue !== control.persistedValue && (
        <dl className="mt-3 grid gap-1 text-[11px]">
          <div className="flex gap-2">
            <dt className="text-gray-500">{t('settings.model.active')}</dt>
            <dd className="text-gray-200">{control.activeLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500">{t('settings.model.persisted')}</dt>
            <dd className="text-gray-200">{control.persistedLabel}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
