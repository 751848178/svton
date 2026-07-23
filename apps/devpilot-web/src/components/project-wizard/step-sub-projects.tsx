'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

const SUB_PROJECT_IDS = ['backend', 'admin', 'mobile'] as const;
type SubProjectId = (typeof SUB_PROJECT_IDS)[number];

/** 子项目类型 lucide 风格（stroke 制 24x24）内联图标，替代 emoji。 */
const SUB_PROJECT_ICONS: Record<SubProjectId, ReactNode> = {
  // rocket — 后端服务
  backend: (
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
  ),
  // monitor — 管理端
  admin: (
    <>
      <rect
        x="2"
        y="3"
        width="20"
        height="14"
        rx="2"
      />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </>
  ),
  // smartphone — 移动端
  mobile: (
    <>
      <rect
        x="5"
        y="2"
        width="14"
        height="20"
        rx="2"
      />
      <path d="M12 18h.01" />
    </>
  ),
};

function SubProjectIcon({ id, className }: { id: SubProjectId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {SUB_PROJECT_ICONS[id]}
    </svg>
  );
}

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
              <SubProjectIcon
                id={id}
                className="h-7 w-7 shrink-0 text-primary"
              />
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
        <Button
          variant="outline"
          onClick={handlePrev}
        >
          {t('prev')}
        </Button>
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={!hasAnySelected}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
