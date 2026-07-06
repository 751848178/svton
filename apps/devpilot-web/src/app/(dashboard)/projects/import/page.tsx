'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useImportProject } from './hooks/use-import-project';
import {
  ScopeSection,
  BasicInfoSection,
  RepoStackSection,
  DeploySection,
  EnvironmentSection,
} from './components/import-form-sections';

export default function ImportProjectPage() {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const { form, setForm, submitting, error, toggleEnvironment, submit } = useImportProject();

  const handleSubmit = usePersistFn(async (event: React.FormEvent<HTMLFormElement>) => {
    const projectId = await submit(event);
    if (projectId) router.push(`/projects/${projectId}`);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('importProjectTitle')}
        description={t('importProjectDescription')}
        actions={
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('backToProjects')}
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <ScopeSection
          form={form}
          onChange={setForm}
          onToggleEnvironment={toggleEnvironment}
        />
        <BasicInfoSection
          form={form}
          onChange={setForm}
          onToggleEnvironment={toggleEnvironment}
        />
        <RepoStackSection
          form={form}
          onChange={setForm}
          onToggleEnvironment={toggleEnvironment}
        />
        {form.managementScope !== 'resources' ? (
          <DeploySection
            form={form}
            onChange={setForm}
            onToggleEnvironment={toggleEnvironment}
          />
        ) : null}
        <EnvironmentSection
          form={form}
          onChange={setForm}
          onToggleEnvironment={toggleEnvironment}
        />

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-3">
          <Link
            href="/projects"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? t('importing') : t('finishImport')}
          </button>
        </div>
      </form>
    </div>
  );
}
