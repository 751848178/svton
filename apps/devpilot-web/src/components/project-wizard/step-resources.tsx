'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import { useProjectConfigStore } from '@/store/hooks';
import type { DatabaseEngine, ProjectResourceConfig, ResourceConfigMode } from '@/store/hooks';
import type {
  StepProps,
  RegistryResourceType,
  StoredResource,
  ResourceInstance,
  ResourcePool,
} from './step-resources-types';
import { DatabaseEngineSelector, ResourceConfigCard, WizardActions } from './step-resources-sub';

const databaseResourceIds = ['mysql', 'postgresql'];
const databaseResourceByEngine: Partial<Record<DatabaseEngine, string>> = {
  mysql: 'mysql',
  postgresql: 'postgresql',
};

export function StepResources({ onNext, onPrev }: StepProps) {
  const t = useTranslations('projectWizard');
  const tp = useTranslations('projects');
  const tc = useTranslations('common');
  const { config, setResources, setDatabase } = useProjectConfigStore();
  const [registryResources, setRegistryResources] = useState<RegistryResourceType[]>([]);
  const [requiredResourceIds, setRequiredResourceIds] = useState<string[]>([]);
  const [storedResources, setStoredResources] = useState<StoredResource[]>([]);
  const [instances, setInstances] = useState<ResourceInstance[]>([]);
  const [pools, setPools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [manualConfigs, setManualConfigs] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    for (const [type, rc] of Object.entries(config.resources || {})) {
      if (rc.config) init[type] = rc.config;
    }
    return init;
  });
  const [selectedCredentials, setSelectedCredentials] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [type, rc] of Object.entries(config.resources || {})) {
      if (rc.credentialId) init[type] = rc.credentialId;
    }
    return init;
  });
  const [selectedInstances, setSelectedInstances] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [type, rc] of Object.entries(config.resources || {})) {
      if (rc.instanceId) init[type] = rc.instanceId;
    }
    return init;
  });
  const [selectedPools, setSelectedPools] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const [type, rc] of Object.entries(config.resources || {})) {
      if (rc.poolId) init[type] = [rc.poolId];
    }
    return init;
  });
  const [poolResourceNames, setPoolResourceNames] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [type, rc] of Object.entries(config.resources || {})) {
      if (rc.poolId && rc.resourceName) init[type] = rc.resourceName;
    }
    return init;
  });
  const [databaseEngine, setDatabaseEngine] = useState<DatabaseEngine>(config.database.engine);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regData, storedData, instData, poolData] = await Promise.all([
        apiRequest<RegistryResourceType[]>('GET:/registry/resource-types'),
        apiRequest<StoredResource[]>('GET:/resources'),
        apiRequest<ResourceInstance[]>('GET:/resource-instances'),
        apiRequest<ResourcePool[]>('GET:/resource-pools'),
      ]);
      setRegistryResources(regData);
      setStoredResources(storedData);
      setInstances(instData);
      setPools(poolData);
      const dbResourceIds = regData
        .filter((r) => databaseResourceIds.includes(r.id))
        .map((r) => r.id);
      const featureResourceIds = (config.features || []).map((f) => f.replace(/-/g, '_'));
      const required = regData.filter(
        (r) => dbResourceIds.includes(r.id) || featureResourceIds.includes(r.id),
      );
      setRequiredResourceIds(required.map((r) => r.id));
      setLoadError('');
    } catch (error) {
      console.error('Failed to load resources:', error);
      setLoadError(tp('resourceLoadError'));
    } finally {
      setLoading(false);
    }
  }, [config.subProjects.backend, config.features]);

  useEffect(() => {
    loadData().catch(() => {
      // 错误已在 loadData 内捕获并写入 loadError，此处仅吞掉 rejection。
    });
  }, [loadData]);

  const requiredResources = registryResources.filter((r) => requiredResourceIds.includes(r.id));

  const updateResourceEntry = usePersistFn(
    (resourceType: string, partial: Partial<Omit<ProjectResourceConfig, 'type'>>) => {
      const current = { ...(config.resources || {}) };
      const existing: ProjectResourceConfig = current[resourceType] || {
        type: resourceType,
        mode: 'manual',
      };
      current[resourceType] = { ...existing, ...partial };
      setResources(current);
    },
  );
  const handleFieldChange = usePersistFn((resourceType: string, field: string, value: string) => {
    const nextFields = { ...(manualConfigs[resourceType] || {}), [field]: value };
    setManualConfigs((current) => ({
      ...current,
      [resourceType]: nextFields,
    }));
    updateResourceEntry(resourceType, { config: nextFields });
  });
  const handleCredentialChange = usePersistFn((resourceType: string, credentialId: string) => {
    setSelectedCredentials((current) => ({ ...current, [resourceType]: credentialId }));
    const name = storedResources.find((s) => s.id === credentialId)?.name;
    updateResourceEntry(resourceType, { credentialId, resourceName: name });
  });
  const handleInstanceChange = usePersistFn((resourceType: string, instanceId: string) => {
    setSelectedInstances((current) => ({ ...current, [resourceType]: instanceId }));
    const name = instances.find((i) => i.id === instanceId)?.name;
    updateResourceEntry(resourceType, { instanceId, resourceName: name });
  });
  const handlePoolChange = usePersistFn((resourceType: string, poolId: string) => {
    setSelectedPools((current) => ({ ...current, [resourceType]: poolId ? [poolId] : [] }));
    const pool = pools.find((p) => p.id === poolId);
    setPoolResourceNames((current) => ({ ...current, [resourceType]: pool?.name || '' }));
    updateResourceEntry(resourceType, { poolId, resourceName: pool?.name });
  });
  const handleModeChange = usePersistFn((resourceType: string, mode: ResourceConfigMode) => {
    const current = { ...(config.resources || {}) };
    if (mode === 'skipped') {
      delete current[resourceType];
    } else {
      // 切换模式时保留该资源已填写的字段，避免误删另一模式已存配置。
      current[resourceType] = { ...current[resourceType], type: resourceType, mode };
    }
    setResources(current);
  });
  const handleDatabaseEngineChange = usePersistFn((engine: DatabaseEngine) => {
    setDatabaseEngine(engine);
    setDatabase({ engine });
  });
  const handleNext = usePersistFn(() => onNext());

  if (loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      {loadError ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => loadData()}
          retryLabel={tc('retry')}
        />
      ) : null}
      {config.subProjects.backend && !loadError && (
        <DatabaseEngineSelector
          value={databaseEngine}
          onChange={handleDatabaseEngineChange}
        />
      )}
      {loadError ? null : requiredResources.length === 0 ? (
        <EmptyState text={t('noResourcesRequired')} />
      ) : (
        requiredResources.map((resource) => (
          <ResourceConfigCard
            key={resource.id}
            resource={resource}
            mode={config.resources?.[resource.id]?.mode || 'skipped'}
            storedResources={storedResources}
            instances={instances}
            pools={pools}
            manualValues={manualConfigs[resource.id] || {}}
            credentialId={selectedCredentials[resource.id] || ''}
            instanceId={selectedInstances[resource.id] || ''}
            poolId={selectedPools[resource.id]?.[0] || ''}
            onModeChange={(mode) => handleModeChange(resource.id, mode)}
            onFieldChange={(field, value) => handleFieldChange(resource.id, field, value)}
            onCredentialChange={(id) => handleCredentialChange(resource.id, id)}
            onInstanceChange={(id) => handleInstanceChange(resource.id, id)}
            onPoolChange={(id) => handlePoolChange(resource.id, id)}
          />
        ))
      )}
      <WizardActions
        onPrev={onPrev}
        onNext={handleNext}
        nextDisabled={Boolean(loadError)}
      />
    </div>
  );
}
