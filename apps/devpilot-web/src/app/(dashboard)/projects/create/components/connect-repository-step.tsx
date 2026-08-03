import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

export function ConnectRepositoryStep({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const { form, updateForm, projectId } = intake;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{t('intakeConnectTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('intakeConnectDescription')}</p>
      </div>
      {projectId ? (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
          {t('intakeDraftRetained')}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('intakeVisibility')}>
          <Select
            value={form.visibility}
            onChange={(event) =>
              updateForm({ visibility: event.target.value as 'public' | 'private' })
            }
            options={[
              { label: t('intakeVisibilityPublic'), value: 'public' },
              { label: t('intakeVisibilityPrivate'), value: 'private' },
            ]}
          />
        </Field>
        <Field label={t('nameLabel')}>
          <Input
            value={form.name}
            onChange={(event) => updateForm({ name: event.target.value })}
            placeholder={t('intakeNamePlaceholder')}
          />
        </Field>
        <Field label={t('branchLabel')}>
          <Input
            value={form.branch}
            onChange={(event) => updateForm({ branch: event.target.value })}
            placeholder={t('intakeBranchPlaceholder')}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('gitRepoLabel')}>
            <Input
              required
              value={form.repositoryUrl}
              onChange={(event) => updateForm({ repositoryUrl: event.target.value })}
              placeholder="https://github.com/organization/repository.git"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('descriptionLabel')}>
            <textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={t('intakeDescriptionPlaceholder')}
            />
          </Field>
        </div>
      </div>
      {form.visibility === 'private' ? <PrivateCredentialFields intake={intake} /> : null}
    </div>
  );
}

function PrivateCredentialFields({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const { form, updateForm } = intake;
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{t('intakePrivateCredentialHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('intakeCredentialType')}>
          <Select
            value={form.credentialType}
            onChange={(event) =>
              updateForm({ credentialType: event.target.value as 'https_token' | 'ssh_key' })
            }
            options={[
              { label: 'HTTPS Token', value: 'https_token' },
              { label: 'SSH Key', value: 'ssh_key' },
            ]}
          />
        </Field>
        <Field label={t('intakeCredentialName')}>
          <Input
            required
            value={form.credentialName}
            onChange={(event) => updateForm({ credentialName: event.target.value })}
          />
        </Field>
        <Field label={t('intakeCredentialUsername')}>
          <Input
            value={form.credentialUsername}
            onChange={(event) => updateForm({ credentialUsername: event.target.value })}
          />
        </Field>
        <Field label={t('intakeCredentialSecret')}>
          <Input
            required
            type="password"
            value={form.credentialSecret}
            onChange={(event) => updateForm({ credentialSecret: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
