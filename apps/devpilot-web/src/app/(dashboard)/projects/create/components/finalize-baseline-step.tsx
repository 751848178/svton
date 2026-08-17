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
          reason={t('intakeStagingBaselineReason')}
        />
        <BaselineCard
          name="Production"
          tag={t('intakeBaselineDefault')}
          description={t('intakeProductionDescription')}
          reason={t('intakeProductionBaselineReason')}
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
          value={intake.connection?.commitSha ?? '—'}
        />
        <Summary label={t('intakeReviewSnapshot')} value={intake.contract?.snapshot?.hash ?? '—'} />
      </dl>
      {intake.contract?.overview ? (
        <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
          {Object.entries(intake.contract.overview.value).map(([key, value]) => (
            <Summary
              key={key}
              label={t(`intakeField${capitalize(key)}`)}
              value={t(`intakeValue${pascal(value)}`)}
            />
          ))}
        </dl>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/40"><tr>
            <th className="p-3">{t('intakeComponentName')}</th>
            <th className="p-3">{t('intakeComponentPath')}</th>
            <th className="p-3">{t('intakeComponentType')}</th>
            <th className="p-3">{t('intakeComponentBuildOutput')}</th>
            <th className="p-3">{t('intakeComponentRunMethod')}</th>
          </tr></thead>
          <tbody>{intake.contract?.components
            .filter((item) => item.decision !== 'reject')
            .map((item) => <tr key={item.suggestionId} className="border-t">
              <td className="p-3 font-medium">{item.value.name}</td>
              <td className="p-3 font-mono">{item.value.path}</td>
              <td className="p-3">{t(`intakeValue${pascal(item.value.type)}`)}</td>
              <td className="p-3">{t(`intakeValue${pascal(item.value.buildOutput)}`)}</td>
              <td className="p-3">{t(`intakeValue${pascal(item.value.runMethod)}`)}</td>
            </tr>)}</tbody>
        </table>
      </div>
      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
        {t('intakeDeferredConfiguration')}
      </div>
    </div>
  );
}

function capitalize(value: string) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function pascal(value: string) { return value.split('_').map(capitalize).join(''); }

function BaselineCard(props: {
  name: string; tag: string; description: string; reason: string;
}) {
  return (
    <article className="rounded-lg border p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{props.name}</h3>
        <Tag color="green">{props.tag}</Tag>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{props.reason}</p>
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
