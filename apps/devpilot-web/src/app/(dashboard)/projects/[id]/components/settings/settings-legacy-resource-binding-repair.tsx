'use client';

import React, { useState } from 'react';
import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import {
  buildResourceBindingPreview,
  type ResourceBindingPreview,
} from './settings-resource-binding-preview.model';
import {
  SettingsResourceBindingPreview,
  type ComponentOption,
} from './settings-resource-binding-preview';

type ResourceCandidate = {
  id: string;
  kind: EnvironmentConfigResourceReference['kind'];
  resourceType?: { envTemplate?: string | null } | null;
};

export function SettingsLegacyResourceBindingRepair(props: {
  reference: EnvironmentConfigResourceReference;
  candidate: ResourceCandidate;
  components: ComponentOption[];
  onRepair: (reference: EnvironmentConfigResourceReference) => void;
}) {
  const initial = buildResourceBindingPreview(
    props.candidate,
    null,
    [props.reference],
  );
  const [preview, setPreview] = useState<ResourceBindingPreview>(initial);
  const updateBinding = (sourceKey: string, targetEnvKey: string) =>
    setPreview((current) => ({
      ...current,
      status: 'draft',
      envBindings: current.envBindings.map((binding) =>
        binding.sourceKey === sourceKey ? { ...binding, targetEnvKey } : binding),
    }));
  return (
    <SettingsResourceBindingPreview
      preview={preview}
      components={props.components}
      onComponentChange={(componentKey) =>
        setPreview((current) => ({ ...current, componentKey, status: 'draft' }))
      }
      onTargetChange={updateBinding}
      onConfirm={() => {
        if (!preview.componentKey) return;
        props.onRepair({
          ...props.reference,
          componentKey: preview.componentKey,
          envBindings: preview.envBindings,
          bindingStatus: 'configured',
        });
      }}
    />
  );
}
