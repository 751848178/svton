/** 项目向导资源步骤子组件。 */
import { Tag } from '@svton/ui';

import type { DatabaseEngine, ResourceConfigMode } from '@/store/hooks';
import type {
  RegistryResourceType,
  StoredResource,
  ResourceInstance,
  ResourcePool,
} from './step-resources-types';

export const modeLabels: Record<string, string> = {
  manual: '手动填写',
  credential: '已有凭证',
  instance: '资源实例',
  pool: '资源池分配',
  skipped: '跳过',
};

export const databaseOptions: { engine: DatabaseEngine; label: string; description: string }[] = [
  { engine: 'mysql', label: 'MySQL', description: '默认本地开发数据库' },
  { engine: 'postgresql', label: 'PostgreSQL', description: '兼容现有 PG 项目' },
  { engine: 'sqlite', label: 'SQLite', description: '无需外部数据库服务' },
];

function DatabaseEngineSelector({
  value,
  onChange,
}: {
  value: DatabaseEngine;
  onChange: (engine: DatabaseEngine) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">数据库引擎</label>
      <div className="grid grid-cols-3 gap-3">
        {databaseOptions.map((option) => (
          <button
            key={option.engine}
            type="button"
            onClick={() => onChange(option.engine)}
            className={`rounded-lg border p-4 text-left transition-colors ${value === option.engine ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
          >
            <div className="font-medium">{option.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResourceConfigCard({
  resource,
  mode,
  storedResources,
  instances,
  pools,
  onModeChange,
}: {
  resource: RegistryResourceType;
  mode: ResourceConfigMode;
  storedResources: StoredResource[];
  instances: ResourceInstance[];
  pools: ResourcePool[];
  onModeChange: (mode: ResourceConfigMode) => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{resource.name}</h3>
          {resource.description && (
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          )}
        </div>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as ResourceConfigMode)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="skipped">跳过</option>
          <option value="manual">手动填写</option>
          <option value="credential">已有凭证</option>
          <option value="instance">资源实例</option>
          <option value="pool">资源池分配</option>
        </select>
      </div>
      {mode === 'manual' && (
        <div className="mt-3 space-y-2">
          {resource.fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <input
                type={field.type || 'text'}
                placeholder={field.default?.toString()}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}
      {mode === 'credential' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">选择已有凭证</label>
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">请选择</option>
            {storedResources.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === 'instance' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">选择资源实例</label>
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">请选择</option>
            {instances.map((i) => (
              <option
                key={i.id}
                value={i.id}
              >
                {i.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === 'pool' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">选择资源池</label>
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">请选择</option>
            {pools.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name} ({p.available} 可用)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
          >
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function WizardActions({
  onPrev,
  onNext,
  nextDisabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between pt-4">
      <button
        type="button"
        onClick={onPrev}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        上一步
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        下一步
      </button>
    </div>
  );
}

export { DatabaseEngineSelector, ResourceConfigCard, SelectField, WizardActions };
