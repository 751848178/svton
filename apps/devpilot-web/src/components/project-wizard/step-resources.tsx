'use client';

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { LoadingState } from '@svton/ui';
import { apiRequest } from '@/lib/api-client';
import { useProjectConfigStore } from '@/store/hooks';
import type { DatabaseEngine, ResourceConfigMode } from '@/store/hooks';
import type {
  StepProps,
  RegistryResourceType,
  StoredResource,
  ResourceInstance,
  ResourcePool,
} from './step-resources-types';
import { collectSelections, filterDatabaseResourceMap } from './step-resources-types';
import {
  modeLabels,
  databaseOptions,
  DatabaseEngineSelector,
  ResourceConfigCard,
  SelectField,
  WizardActions,
} from './step-resources-sub';

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
  const [manualConfigs, setManualConfigs] = useState<Record<string, Record<string, string>>>({});
  const [selectedCredentials, setSelectedCredentials] = useState<Record<string, string>>({});
  const [selectedInstances, setSelectedInstances] = useState<Record<string, string>>({});
  const [selectedPools, setSelectedPools] = useState<Record<string, string[]>>({});
  const [poolResourceNames, setPoolResourceNames] = useState<Record<string, string>>({});
  const [databaseEngine, setDatabaseEngine] = useState<DatabaseEngine>(config.database.engine);

  useEffect(() => {
    let canceled = false;
    const loadData = async () => {
      try {
        const [regData, storedData, instData, poolData] = await Promise.all([
          apiRequest<RegistryResourceType[]>('GET:/registry/resource-types'),
          apiRequest<StoredResource[]>('GET:/resources'),
          apiRequest<ResourceInstance[]>('GET:/resource-instances'),
          apiRequest<ResourcePool[]>('GET:/resource-pools'),
        ]);
        if (canceled) return;
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
      } catch (error) {
        console.error('Failed to load resources:', error);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    loadData();
    return () => {
      canceled = true;
    };
  }, [config.subProjects.backend, config.features]);

  const requiredResources = registryResources.filter((r) => requiredResourceIds.includes(r.id));

  const handleFieldChange = usePersistFn((resourceType: string, field: string, value: string) => {
    setManualConfigs((current) => ({
      ...current,
      [resourceType]: { ...current[resourceType], [field]: value },
    }));
  });
  const handleModeChange = usePersistFn((resourceType: string, mode: ResourceConfigMode) => {
    const current = { ...(config.resources || {}) };
    if (mode === 'skipped' || mode === 'manual') {
      delete current[resourceType];
    }
    setResources(
      Object.fromEntries(Object.entries(current).filter(([type]) => type !== resourceType)),
    );
  });
  const handleDatabaseEngineChange = usePersistFn((engine: DatabaseEngine) => {
    setDatabaseEngine(engine);
    setDatabase({ engine });
  });
  const handleNext = usePersistFn(() => onNext());

  if (loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      {config.subProjects.backend && (
        <DatabaseEngineSelector
          value={databaseEngine}
          onChange={handleDatabaseEngineChange}
        />
      )}
      {requiredResources.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">当前配置不需要额外的资源凭证</div>
      ) : (
        requiredResources.map((resource) => (
          <ResourceConfigCard
            key={resource.id}
            resource={resource}
            mode={config.resources?.[resource.id]?.mode || 'skipped'}
            storedResources={storedResources}
            instances={instances}
            pools={pools}
            onModeChange={(mode) => handleModeChange(resource.id, mode)}
          />
        ))
      )}
      <WizardActions
        onPrev={onPrev}
        onNext={handleNext}
      />
    </div>
  );
}
