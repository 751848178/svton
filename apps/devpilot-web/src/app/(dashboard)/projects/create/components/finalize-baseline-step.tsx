import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

export function FinalizeBaselineStep({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{t('intakeBaselineTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('intakeBaselineDescription')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <BaselineCard
          name="Staging"
          tag={t('intakeBaselineDefault')}
          description={t('intakeStagingDescription')}
        />
        <BaselineCard
          name="Production"
          tag={t('intakeBaselineDefault')}
          description={t('intakeProductionDescription')}
        />
      </div>
      <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
        <Summary
          label={t('nameLabel')}
          value={intake.form.name}
        />
        <Summary
          label={t('gitRepoLabel')}
          value={intake.form.repositoryUrl}
        />
        <Summary
          label={t('branchLabel')}
          value={(intake.connection?.selectedBranch ?? intake.form.branch) || '—'}
        />
        <Summary
          label={t('intakeCommit')}
          value={intake.connection?.commitSha?.slice(0, 12) ?? '—'}
        />
      </dl>
      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
        {t('intakeDeferredConfiguration')}
      </div>
    </div>
  );
}

function BaselineCard(props: { name: string; tag: string; description: string }) {
  return (
    <article className="rounded-lg border p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{props.name}</h3>
        <Tag color="green">{props.tag}</Tag>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
