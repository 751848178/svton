'use client';

import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { usePolicies } from './hooks/use-policies';
import { PolicyFormView } from './components/policy-form';
import { PolicyCard } from './components/policy-card';

export default function ExecutionPoliciesPage() {
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
    stats,
    selectProject,
    save,
    edit,
    reset,
    toggle,
    remove,
    reload,
  } = usePolicies();
  const handleRetry = usePersistFn(() => reload());

  if (loading) {
    return <LoadingState text="加载中..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="执行策略"
        description="管理 Server executor 在团队、项目和环境范围内的命令 allow/block 模板"
        actions={
          <button
            onClick={handleRetry}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            刷新
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
          label="策略模板"
          value={stats.total}
        />
        <MetricCard
          label="已启用"
          value={stats.enabled}
        />
        <MetricCard
          label="限定作用域"
          value={stats.scoped}
        />
        <MetricCard
          label="Block 规则"
          value={stats.blockingRules}
        />
        <MetricCard
          label="Allow 规则"
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
          <h2 className="font-semibold">策略模板列表</h2>
        </div>
        {templates.length === 0 ? (
          <EmptyState text="还没有执行策略模板" />
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
    </div>
  );
}
