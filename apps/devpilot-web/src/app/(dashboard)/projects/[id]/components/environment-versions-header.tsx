import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';

export function EnvironmentVersionsHeader({ count }: { count?: number }) {
  const t = useTranslations('projects');

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">
          {t('directoryBaselines')} · {t('environmentVersionPageTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('environmentVersionsDescription')} · {t('envRoleStaging')} / {t('envRoleProduction')}
        </p>
      </div>
      {count === undefined ? null : (
        <StatusTag
          status="success"
          label={t('environmentVersionEnvironmentCount', { count })}
        />
      )}
    </div>
  );
}
