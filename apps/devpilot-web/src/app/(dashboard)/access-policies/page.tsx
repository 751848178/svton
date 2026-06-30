'use client';

import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useAccessPolicies } from './hooks/use-access-policies';
import { PolicyFormView } from './components/policy-form';
import { PolicyCard } from './components/policy-card';

export default function AccessPoliciesPage() {
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
    stats,
    selectProject,
    save,
    edit,
    reset,
    toggle,
    remove,
    reload,
  } = useAccessPolicies();
  const handleRetry = usePersistFn(() => reload());

  if (loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="访问策略"
        description="管理控制面在项目、环境、操作分类和风险等级上的 allow/deny 策略"
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
          label="策略数"
          value={stats.total}
        />
        <MetricCard
          label="已启用"
          value={stats.enabled}
        />
        <MetricCard
          label="拒绝策略"
          value={stats.denies}
        />
        <MetricCard
          label="限定作用域"
          value={stats.scoped}
        />
        <MetricCard
          label="用户级"
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
          <h2 className="text-lg font-semibold">策略列表</h2>
        </div>
        {policies.length === 0 ? (
          <EmptyState text="暂无访问策略" />
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
    </div>
  );
}
