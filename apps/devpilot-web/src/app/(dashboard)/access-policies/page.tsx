'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAccessPolicies } from './hooks/use-access-policies';
import { PolicyFormView } from './components/policy-form';
import { PolicyCard } from './components/policy-card';

export default function AccessPoliciesPage() {
  const t = useTranslations('accessPolicies');
  const tc = useTranslations('common');
  const {
    policies,
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
  } = useAccessPolicies();
  const handleRetry = usePersistFn(() => reload());

  if (loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={handleRetry}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
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
          label={t('metricPolicies')}
          value={stats.total}
        />
        <MetricCard
          label={tc('enabled')}
          value={stats.enabled}
        />
        <MetricCard
          label={t('metricDenies')}
          value={stats.denies}
        />
        <MetricCard
          label={t('metricScoped')}
          value={stats.scoped}
        />
        <MetricCard
          label={t('metricUserScoped')}
          value={stats.userScoped}
        />
      </div>

      <PolicyFormView
        form={form}
        onChange={setForm}
        editingId={editingId}
        saving={saving}
        projects={projects}
        environmentOptions={environmentOptions}
        onSubmit={save}
        onReset={reset}
        onSelectProject={selectProject}
      />

      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">{t('policyListTitle')}</h2>
        </div>
        {policies.length === 0 ? (
          <EmptyState text={t('noPolicies')} />
        ) : (
          <div className="divide-y">
            {policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
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
        title={t('deletePolicyTitle')}
        description={
          deleteTarget ? t('deletePolicyDescription', { name: deleteTarget.name }) : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
