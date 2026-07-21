'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePolicies } from './hooks/use-policies';
import { PolicyFormView } from './components/policy-form';
import { PolicyCard } from './components/policy-card';

export default function ExecutionPoliciesPage() {
  const t = useTranslations('executionPolicies');
  const tc = useTranslations('common');
  const {
    templates,
    projects,
    environments,
    environmentOptions,
    form,
    setForm,
    editingId,
    loading,
    saving,
    actingId,
    error,
    deleteTarget,
    stats,
    selectProject,
    save,
    edit,
    reset,
    toggle,
    remove,
    cancelRemove,
    confirmRemove,
    reload,
  } = usePolicies();
  const handleRetry = usePersistFn(() => reload());

  if (loading) {
    return <LoadingState text={tc('loading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={handleRetry}
            className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent"
          >
            {tc('refresh')}
          </button>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard
          label={t('metricTemplates')}
          value={stats.total}
        />
        <MetricCard
          label={tc('enabled')}
          value={stats.enabled}
        />
        <MetricCard
          label={t('metricScoped')}
          value={stats.scoped}
        />
        <MetricCard
          label={t('metricBlockRules')}
          value={stats.blockingRules}
        />
        <MetricCard
          label={t('metricAllowRules')}
          value={stats.allowingRules}
        />
      </div>

      <PolicyFormView
        form={form}
        onChange={setForm}
        editingId={editingId}
        saving={saving}
        projects={projects}
        environmentOptions={environmentOptions}
        environments={environments}
        onSubmit={save}
        onReset={reset}
        onSelectProject={selectProject}
      />

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-semibold">{t('templateListTitle')}</h2>
        </div>
        {templates.length === 0 ? (
          <EmptyState text={t('noTemplates')} />
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <PolicyCard
                key={template.id}
                template={template}
                actingId={actingId}
                onEdit={edit}
                onToggle={toggle}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) cancelRemove();
        }}
        tone="danger"
        title={t('deleteTemplateTitle')}
        description={
          deleteTarget ? t('deleteTemplateDescription', { name: deleteTarget.name }) : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
