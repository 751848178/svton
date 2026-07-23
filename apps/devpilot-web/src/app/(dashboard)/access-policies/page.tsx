'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn, useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard, Button, Modal } from '@/components/ui';
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
  const [formOpen, { setTrue: openForm, setFalse: closeForm }] = useBoolean(false);
  const wasSaving = useRef(false);

  // 编辑入口（来自卡片）会写入 editingId；同步打开弹窗。
  useEffect(() => {
    if (editingId) openForm();
  }, [editingId, openForm]);

  // 删除当前正在编辑的记录时，confirmRemove 内部 reset() 会清空 editingId，
  // 但表单弹窗仍开着，会停留在空「新建」态。这里包一层：若删除目标即编辑目标则关闭弹窗。
  const handleConfirmRemove = usePersistFn(async () => {
    const deletingEditing = Boolean(editingId) && deleteTarget?.id === editingId;
    await confirmRemove();
    if (deletingEditing) closeForm();
  });

  // 保存结束（saving true→false）且无错误时关闭弹窗。
  useEffect(() => {
    if (wasSaving.current && !saving && !error) {
      closeForm();
    }
    wasSaving.current = saving;
  }, [saving, error, closeForm]);

  const handleCloseForm = usePersistFn(() => {
    closeForm();
    reset();
  });

  if (loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRetry}
            >
              {tc('refresh')}
            </Button>
            <Button onClick={() => { reset(); openForm(); }}>
              {t('newPolicy')}
            </Button>
          </div>
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

      <Modal
        open={formOpen}
        onClose={handleCloseForm}
        title={editingId ? t('editPolicy') : t('newPolicy')}
        width={1024}
      >
        <PolicyFormView
          form={form}
          onChange={setForm}
          editingId={editingId}
          saving={saving}
          projects={projects}
          environmentOptions={environmentOptions}
          onSubmit={save}
          onReset={handleCloseForm}
          onSelectProject={selectProject}
        />
      </Modal>

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
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
