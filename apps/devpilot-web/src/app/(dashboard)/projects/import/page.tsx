'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { form, setForm, submitting, error, toggleEnvironment, submit } = useImportProject();

  const handleSubmit = usePersistFn(async (event: React.FormEvent<HTMLFormElement>) => {
    const projectId = await submit(event);
    if (projectId) router.push(`/projects/${projectId}`);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="接入已有项目"
        description="创建一个不依赖初始化器的项目管控入口"
        actions={
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            返回项目列表
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
            取消
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? '接入中...' : '完成接入'}
          </button>
        </div>
      </form>
    </div>
  );
}
