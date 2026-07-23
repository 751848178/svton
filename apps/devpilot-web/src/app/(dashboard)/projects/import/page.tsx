'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button, LinkButton, PageHeader, ErrorBanner } from '@/components/ui';
import { useImportProject } from './hooks/use-import-project';
import {
  ScopeSection,
  BasicInfoSection,
  RepoStackSection,
  DeploySection,
  EnvironmentSection,
  IMPORT_SECTION_ANCHORS,
} from './components/import-form-sections';

export default function ImportProjectPage() {
  const t = useTranslations('projects');
  const tw = useTranslations('projectWizard');
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
          <Link href="/projects" className="link text-sm">
            {t('backToProjects')}
          </Link>
        }
      />

      {/* 表单分区锚点导航 */}
      <nav className="flex flex-wrap gap-2">
        {IMPORT_SECTION_ANCHORS.map((anchor) => (
          <a
            key={anchor.id}
            href={`#${anchor.id}`}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {tw(anchor.titleKey)}
          </a>
        ))}
      </nav>

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
          <LinkButton
            href="/projects"
            variant="outline"
          >
            {tc('cancel')}
          </LinkButton>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
          >
            {submitting ? t('importing') : t('finishImport')}
          </Button>
        </div>
      </form>
    </div>
  );
}
