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
      <Field label={t('intakeRepositoryAddress')} helper={t('intakeRepositoryHelper')}>
        <Input
          required
          autoFocus
          value={form.repositoryUrl}
          onChange={(event) => updateForm({ repositoryUrl: event.target.value })}
          placeholder="https://github.com/organization/repository.git"
        />
      </Field>
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
      {form.visibility === 'private' ? (
        <PrivateCredentialFields intake={intake} />
      ) : null}
      <details className="rounded-lg border bg-muted/20">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          {t('intakeOptionalDetails')}
        </summary>
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
          <Field label={t('intakeProjectName')} helper={t('intakeNameHelper')}>
            <Input
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder={t('intakeNamePlaceholder')}
            />
          </Field>
          <Field label={t('branchLabel')} helper={t('intakeBranchHelper')}>
            <Input
              value={form.branch}
              onChange={(event) => updateForm({ branch: event.target.value })}
              placeholder={t('intakeBranchPlaceholder')}
            />
          </Field>
          <Field label={t('descriptionLabel')}>
            <textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={t('intakeDescriptionPlaceholder')}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

function PrivateCredentialFields({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const { form, updateForm } = intake;
  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">{t('intakeVisibilityPrivate')}</legend>
      <p id="private-repository-credential-hint" className="text-sm text-muted-foreground">
        {t('intakePrivateCredentialHint')}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('intakeCredentialMode')}>
          <Select
            aria-describedby="private-repository-credential-hint"
            value={form.credentialMode}
            onChange={(event) =>
              updateForm({ credentialMode: event.target.value as 'managed' | 'inline' })
            }
            options={[
              { label: t('intakeCredentialManaged'), value: 'managed' },
              { label: t('intakeCredentialInline'), value: 'inline' },
            ]}
          />
        </Field>
        {form.credentialMode === 'managed' ? (
          <Field label={t('intakeCredentialReference')}>
            <Select
              required
              value={form.teamCredentialId}
              onChange={(event) => updateForm({ teamCredentialId: event.target.value })}
              options={[
                { label: t('intakeCredentialSelect'), value: '' },
                ...intake.credentialOptions.map((option) => ({
                  label: option.label,
                  value: option.id,
                })),
              ]}
            />
          </Field>
        ) : null}
        {form.credentialMode === 'inline' ? (
          <>
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
                autoComplete="off"
                aria-describedby="private-repository-credential-hint"
                value={form.credentialSecret}
                onChange={(event) => updateForm({ credentialSecret: event.target.value })}
              />
            </Field>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {helper ? (
        <small className="block text-xs font-normal text-muted-foreground">{helper}</small>
      ) : null}
    </label>
  );
}
