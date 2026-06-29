'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useProjectConfigStore } from '@/store/project-config';
import type { DatabaseEngine, ProjectResourceConfig, ResourceConfigMode } from '@/store/project-config';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

interface RegistryResourceField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  default?: string | number;
}

interface RegistryResourceType {
  id: string;
  name: string;
  description?: string;
  fields: RegistryResourceField[];
}

interface StoredResource {
  id: string;
  type: string;
  name: string;
}

interface ResourceInstance {
  id: string;
  name: string;
  status: string;
  resourceType?: { key: string; name: string };
  project?: { name: string };
}

interface ResourcePool {
  id: string;
  type: string;
  name: string;
  status: string;
  available: number;
}

const modeLabels: Record<ResourceConfigMode, string> = {
  manual: '手动填写',
  credential: '已有凭证',
  instance: '资源实例',
  pool: '资源池分配',
  skipped: '跳过',
};

const databaseOptions: { engine: DatabaseEngine; label: string; description: string }[] = [
  { engine: 'mysql', label: 'MySQL', description: '默认本地开发数据库' },
  { engine: 'postgresql', label: 'PostgreSQL', description: '兼容现有 PG 项目' },
  { engine: 'sqlite', label: 'SQLite', description: '无需外部数据库服务' },
];

const databaseResourceIds = ['mysql', 'postgresql'];

const databaseResourceByEngine: Partial<Record<DatabaseEngine, string>> = {
  mysql: 'mysql',
  postgresql: 'postgresql',
};

export function StepResources({ onNext, onPrev }: StepProps) {
  const { config, setResources, setDatabase } = useProjectConfigStore();
  const [registryResources, setRegistryResources] = useState<RegistryResourceType[]>([]);
  const [requiredResourceIds, setRequiredResourceIds] = useState<string[]>([]);
  const [storedResources, setStoredResources] = useState<StoredResource[]>([]);
  const [instances, setInstances] = useState<ResourceInstance[]>([]);
  const [pools, setPools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [resourceModes, setResourceModes] = useState<Record<string, ResourceConfigMode>>(() => {
    return Object.fromEntries(
      Object.entries(config.resources).map(([type, resource]) => [type, resource.mode]),
    );
  });
  const [manualConfigs, setManualConfigs] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    for (const [type, resource] of Object.entries(config.resources)) {
      if (resource.mode === 'manual' && resource.config) {
        initial[type] = resource.config;
      }
    }
    return initial;
  });
  const [credentialSelections, setCredentialSelections] = useState<Record<string, string>>(() => {
    return collectSelections(config.resources, 'credentialId');
  });
  const [instanceSelections, setInstanceSelections] = useState<Record<string, string>>(() => {
    return collectSelections(config.resources, 'instanceId');
  });
  const [poolSelections, setPoolSelections] = useState<Record<string, string>>(() => {
    return collectSelections(config.resources, 'poolId');
  });
  const [poolResourceNames, setPoolResourceNames] = useState<Record<string, string>>(() => {
    return collectSelections(config.resources, 'resourceName');
  });

  const selectedFeatureKey = config.features.join(',');
  const databaseEngine = config.database?.engine || 'mysql';
  const selectedSubProjectKey = Object.entries(config.subProjects)
    .filter(([, enabled]) => enabled)
    .map(([type]) => type)
    .join(',');

  useEffect(() => {
    let canceled = false;

    const loadData = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [resourceTypes, resolvedResources, resources, activeInstances, availablePools] = await Promise.all([
          api.get<RegistryResourceType[]>('/registry/resource-types'),
          api.get<string[]>('/registry/resolve/resources', {
            params: { features: selectedFeatureKey },
          }),
          api.get<StoredResource[]>('/resources'),
          api.get<ResourceInstance[]>('/resource-instances', {
            params: { status: 'active' },
          }),
          api.get<ResourcePool[]>('/resource-pools/available').catch(() => []),
        ]);

        if (canceled) return;

        const resourceIds = new Set(resolvedResources);
        const databaseResourceId = databaseResourceByEngine[databaseEngine] || null;
        if (config.subProjects.backend) {
          if (databaseResourceId) {
            resourceIds.add(databaseResourceId);
          }
        }

        setRegistryResources(resourceTypes);
        setRequiredResourceIds(Array.from(resourceIds));
        setStoredResources(resources);
        setInstances(activeInstances);
        setPools(availablePools);
      } catch (error) {
        if (!canceled) {
          setLoadError(error instanceof Error ? error.message : '加载资源失败');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      canceled = true;
    };
  }, [config.subProjects.backend, databaseEngine, selectedFeatureKey, selectedSubProjectKey]);

  const resourceById = useMemo(() => {
    return Object.fromEntries(registryResources.map((resource) => [resource.id, resource]));
  }, [registryResources]);

  const requiredResources = useMemo(() => {
    return requiredResourceIds
      .map((id) => resourceById[id])
      .filter((resource): resource is RegistryResourceType => Boolean(resource));
  }, [requiredResourceIds, resourceById]);

  const getMode = (resourceType: string): ResourceConfigMode => {
    return resourceModes[resourceType] || config.resources[resourceType]?.mode || 'manual';
  };

  const setMode = (resourceType: string, mode: ResourceConfigMode) => {
    setResourceModes((current) => ({ ...current, [resourceType]: mode }));
  };

  const handleFieldChange = (resourceType: string, field: string, value: string) => {
    setManualConfigs((current) => ({
      ...current,
      [resourceType]: {
        ...current[resourceType],
        [field]: value,
      },
    }));
  };

  const buildManualConfig = (resource: RegistryResourceType): Record<string, string> => {
    const configuredFields = manualConfigs[resource.id] || {};
    const resolvedConfig: Record<string, string> = {};

    for (const field of resource.fields) {
      const value = configuredFields[field.key];
      resolvedConfig[field.key] = value || field.default?.toString() || '';
    }

    return resolvedConfig;
  };

  const buildResourceConfig = (resource: RegistryResourceType): ProjectResourceConfig => {
    const mode = getMode(resource.id);

    if (mode === 'skipped') {
      return { type: resource.id, mode };
    }

    if (mode === 'credential') {
      return {
        type: resource.id,
        mode,
        credentialId: credentialSelections[resource.id],
      };
    }

    if (mode === 'instance') {
      return {
        type: resource.id,
        mode,
        instanceId: instanceSelections[resource.id],
      };
    }

    if (mode === 'pool') {
      return {
        type: resource.id,
        mode,
        poolId: poolSelections[resource.id],
        resourceName: poolResourceNames[resource.id] || undefined,
      };
    }

    return {
      type: resource.id,
      mode: 'manual',
      config: buildManualConfig(resource),
    };
  };

  const validateSelection = () => {
    for (const resource of requiredResources) {
      const mode = getMode(resource.id);
      if (mode === 'credential' && !credentialSelections[resource.id]) {
        return `${resource.name} 需要选择已有凭证`;
      }
      if (mode === 'instance' && !instanceSelections[resource.id]) {
        return `${resource.name} 需要选择资源实例`;
      }
      if (mode === 'pool' && !poolSelections[resource.id]) {
        return `${resource.name} 需要选择资源池`;
      }
    }
    return '';
  };

  const handleDatabaseEngineChange = (engine: DatabaseEngine) => {
    const selectedDatabaseResourceId = databaseResourceByEngine[engine] || null;

    setDatabase({ engine });
    setResources(
      filterDatabaseResourceMap(config.resources, selectedDatabaseResourceId),
    );
    setResourceModes((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
    setManualConfigs((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
    setCredentialSelections((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
    setInstanceSelections((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
    setPoolSelections((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
    setPoolResourceNames((current) => filterDatabaseResourceMap(current, selectedDatabaseResourceId));
  };

  const handleNext = () => {
    const error = validateSelection();
    if (error) {
      alert(error);
      return;
    }

    const resources: Record<string, ProjectResourceConfig> = {};
    for (const resource of requiredResources) {
      resources[resource.id] = buildResourceConfig(resource);
    }
    setResources(resources);
    onNext();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">加载资源配置...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
          {loadError}
        </div>
        <WizardActions onPrev={onPrev} onNext={handleNext} nextDisabled />
      </div>
    );
  }

  if (requiredResources.length === 0) {
    return (
      <div className="space-y-6">
        {config.subProjects.backend && (
          <DatabaseEngineSelector
            value={databaseEngine}
            onChange={handleDatabaseEngineChange}
          />
        )}

        <div className="text-center py-8">
          <p className="text-muted-foreground">当前配置不需要额外的资源凭证</p>
        </div>

        <WizardActions
          onPrev={onPrev}
          onNext={() => {
            setResources({});
            onNext();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">配置资源凭证</h3>
        <p className="text-sm text-muted-foreground mb-4">
          根据已选功能和子项目确认资源来源。
        </p>
      </div>

      {config.subProjects.backend && (
        <DatabaseEngineSelector
          value={databaseEngine}
          onChange={handleDatabaseEngineChange}
        />
      )}

      <div className="space-y-4">
        {requiredResources.map((resource) => (
          <ResourceConfigCard
            key={resource.id}
            resource={resource}
            mode={getMode(resource.id)}
            storedResources={storedResources.filter((item) => item.type === resource.id)}
            instances={instances.filter((item) => item.resourceType?.key === resource.id)}
            pools={pools.filter((item) => item.type === resource.id && item.status === 'active' && item.available > 0)}
            manualConfig={manualConfigs[resource.id] || {}}
            credentialId={credentialSelections[resource.id] || ''}
            instanceId={instanceSelections[resource.id] || ''}
            poolId={poolSelections[resource.id] || ''}
            resourceName={poolResourceNames[resource.id] || ''}
            onModeChange={(mode) => setMode(resource.id, mode)}
            onManualChange={(field, value) => handleFieldChange(resource.id, field, value)}
            onCredentialChange={(value) => setCredentialSelections((current) => ({ ...current, [resource.id]: value }))}
            onInstanceChange={(value) => setInstanceSelections((current) => ({ ...current, [resource.id]: value }))}
            onPoolChange={(value) => setPoolSelections((current) => ({ ...current, [resource.id]: value }))}
            onResourceNameChange={(value) => setPoolResourceNames((current) => ({ ...current, [resource.id]: value }))}
          />
        ))}
      </div>

      <WizardActions onPrev={onPrev} onNext={handleNext} />
    </div>
  );
}

function DatabaseEngineSelector({
  value,
  onChange,
}: {
  value: DatabaseEngine;
  onChange: (engine: DatabaseEngine) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <h4 className="font-medium">数据库引擎</h4>
        <p className="text-sm text-muted-foreground mt-1">后端项目会按所选引擎生成 Prisma、环境变量和本地依赖服务。</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {databaseOptions.map((option) => {
          const selected = option.engine === value;

          return (
            <button
              key={option.engine}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.engine)}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                selected ? 'border-primary bg-primary/10' : 'hover:bg-accent'
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground mt-1">{option.description}</span>
            </button>
          );
        })}
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
  manualConfig,
  credentialId,
  instanceId,
  poolId,
  resourceName,
  onModeChange,
  onManualChange,
  onCredentialChange,
  onInstanceChange,
  onPoolChange,
  onResourceNameChange,
}: {
  resource: RegistryResourceType;
  mode: ResourceConfigMode;
  storedResources: StoredResource[];
  instances: ResourceInstance[];
  pools: ResourcePool[];
  manualConfig: Record<string, string>;
  credentialId: string;
  instanceId: string;
  poolId: string;
  resourceName: string;
  onModeChange: (mode: ResourceConfigMode) => void;
  onManualChange: (field: string, value: string) => void;
  onCredentialChange: (value: string) => void;
  onInstanceChange: (value: string) => void;
  onPoolChange: (value: string) => void;
  onResourceNameChange: (value: string) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-medium">{resource.name}</h4>
          {resource.description && (
            <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>
          )}
        </div>
        <select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as ResourceConfigMode)}
          className="w-full sm:w-40 px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="manual">{modeLabels.manual}</option>
          <option value="credential" disabled={storedResources.length === 0}>
            {storedResources.length > 0 ? modeLabels.credential : '暂无凭证'}
          </option>
          <option value="instance" disabled={instances.length === 0}>
            {instances.length > 0 ? modeLabels.instance : '暂无实例'}
          </option>
          <option value="pool" disabled={pools.length === 0}>
            {pools.length > 0 ? modeLabels.pool : '暂无资源池'}
          </option>
          <option value="skipped">{modeLabels.skipped}</option>
        </select>
      </div>

      {mode === 'manual' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {resource.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <input
                type={field.type}
                value={manualConfig[field.key] || ''}
                onChange={(event) => onManualChange(field.key, event.target.value)}
                placeholder={field.default?.toString()}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {mode === 'credential' && (
        <SelectField
          label="已有凭证"
          value={credentialId}
          onChange={onCredentialChange}
          placeholder="选择凭证"
          options={storedResources.map((resourceItem) => ({
            value: resourceItem.id,
            label: resourceItem.name,
          }))}
        />
      )}

      {mode === 'instance' && (
        <SelectField
          label="资源实例"
          value={instanceId}
          onChange={onInstanceChange}
          placeholder="选择实例"
          options={instances.map((instance) => ({
            value: instance.id,
            label: `${instance.name}${instance.project?.name ? ` - ${instance.project.name}` : ''}`,
          }))}
        />
      )}

      {mode === 'pool' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="资源池"
            value={poolId}
            onChange={onPoolChange}
            placeholder="选择资源池"
            options={pools.map((pool) => ({
              value: pool.id,
              label: `${pool.name}（可用 ${pool.available}）`,
            }))}
          />
          <div>
            <label className="block text-sm font-medium mb-1">资源名称</label>
            <input
              value={resourceName}
              onChange={(event) => onResourceNameChange(event.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              placeholder="留空自动生成"
            />
          </div>
        </div>
      )}

      {mode === 'skipped' && (
        <p className="text-sm text-muted-foreground">
          生成结果只保留 `.env.example` 占位变量。
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-background text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
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
        onClick={onPrev}
        className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors"
      >
        上一步
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        下一步
      </button>
    </div>
  );
}

function collectSelections(
  resources: Record<string, ProjectResourceConfig>,
  key: 'credentialId' | 'instanceId' | 'poolId' | 'resourceName',
): Record<string, string> {
  const selections: Record<string, string> = {};

  for (const [type, resource] of Object.entries(resources)) {
    const value = resource[key];
    if (value) {
      selections[type] = value;
    }
  }

  return selections;
}

function filterDatabaseResourceMap<T>(
  map: Record<string, T>,
  selectedDatabaseResourceId: string | null,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(map).filter(([type]) => {
      if (!databaseResourceIds.includes(type)) {
        return true;
      }

      return type === selectedDatabaseResourceId;
    }),
  );
}
