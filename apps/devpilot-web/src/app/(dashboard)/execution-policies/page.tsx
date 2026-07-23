'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn, useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard, Button, Modal } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePolicies } from './hooks/use-policies';
import { PolicyFormView } from './components/policy-form';
import { PolicyCard } from './components/policy-card';
import { PolicyHelp } from './components/policy-help';

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

  if (loading) {
    return <LoadingState text={tc('loading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <PolicyHelp />
            <Button
              variant="outline"
              onClick={handleRetry}
            >
              {tc('refresh')}
            </Button>
            <Button onClick={() => { reset(); openForm(); }}>
              {t('newTemplate')}
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

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-semibold">{t('templateListTitle')}</h2>
        </div>
        {templates.length === 0 ? (
          <EmptyState text={t('noTemplates')} action={<PolicyHelp trigger="link" />} />
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

      <Modal
        open={formOpen}
        onClose={handleCloseForm}
        title={editingId ? t('editTemplate') : t('newTemplate')}
        width={1024}
      >
        <PolicyFormView
          form={form}
          onChange={setForm}
          editingId={editingId}
          saving={saving}
          projects={projects}
          environmentOptions={environmentOptions}
          environments={environments}
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
        title={t('deleteTemplateTitle')}
        description={
          deleteTarget ? t('deleteTemplateDescription', { name: deleteTarget.name }) : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
