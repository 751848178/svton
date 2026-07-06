'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Card, Tag } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

const SUB_PROJECT_IDS = ['backend', 'admin', 'mobile'] as const;
type SubProjectId = (typeof SUB_PROJECT_IDS)[number];
const SUB_PROJECT_ICONS: Record<SubProjectId, string> = {
  backend: '🚀',
  admin: '🖥️',
  mobile: '📱',
};

export function StepSubProjects({ onNext, onPrev }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config, setSubProjects, setUiLibrary, setHooks } = useProjectConfigStore();
  const hasAnySelected = Object.values(config.subProjects).some(Boolean);
  const hasAdminOrMobile = config.subProjects.admin || config.subProjects.mobile;

  const handleToggle = usePersistFn((id: 'backend' | 'admin' | 'mobile') =>
    setSubProjects({ [id]: !config.subProjects[id] }),
  );
  const handleNext = usePersistFn(() => onNext());
  const handlePrev = usePersistFn(() => onPrev());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-medium">{t('selectSubProjects')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('selectSubProjectsHint')}</p>
        <div className="grid gap-4">
          {SUB_PROJECT_IDS.map((id) => (
            <div
              key={id}
              onClick={() => handleToggle(id)}
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${config.subProjects[id] ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <div className="text-2xl">{SUB_PROJECT_ICONS[id]}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{t(`sub_${id}_title`)}</h4>
                  {config.subProjects[id] ? <Tag color="blue">{t('selected')}</Tag> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t(`sub_${id}_desc`)}</p>
              </div>
              <input
                type="checkbox"
                checked={config.subProjects[id]}
                onChange={() => {}}
                className="mt-1 h-5 w-5"
              />
            </div>
          ))}
        </div>
      </div>
      {hasAdminOrMobile ? (
        <div className="border-t pt-6">
          <h3 className="mb-4 text-lg font-medium">{t('frontendLibs')}</h3>
          {config.subProjects.admin ? (
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={config.uiLibrary.admin}
                onChange={(e) => setUiLibrary({ admin: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">
                {t.rich('useUiLibAdmin', {
                  code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
                })}
              </span>
            </label>
          ) : null}
          {config.subProjects.mobile ? (
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={config.uiLibrary.mobile}
                onChange={(e) => setUiLibrary({ mobile: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">
                {t.rich('useUiLibMobile', {
                  code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
                })}
              </span>
            </label>
          ) : null}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={config.hooks}
              onChange={(e) => setHooks(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">
              {t.rich('useHooksLib', {
                code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
              })}
            </span>
          </label>
        </div>
      ) : null}
      {!hasAnySelected ? (
        <ErrorBanner
          message={t('errSelectAtLeastOne')}
          variant="inline"
        />
      ) : null}
      <div className="flex justify-between pt-4">
        <button
          onClick={handlePrev}
          className="rounded-md border px-6 py-2 font-medium transition-colors hover:bg-accent"
        >
          {t('prev')}
        </button>
        <button
          onClick={handleNext}
          disabled={!hasAnySelected}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}
