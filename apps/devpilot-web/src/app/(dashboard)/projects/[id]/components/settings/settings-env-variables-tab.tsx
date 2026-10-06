/** 变量、密钥与跨环境复用；普通变量只暂存，统一由配置修订审阅提交。 */
'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { useEnvironmentEnvCopy } from '../../hooks/use-environment-env-copy';
import { useResourceInstanceInjections } from '../../hooks/use-resource-instance-injections';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import { diffEnvVars } from '../../utils/env-var-diff.utils';
import { EnvironmentConfigRevisionHistory } from '../environment-config-revision-history';
import { EnvironmentEnvCopyDialog } from '../environment-env-copy-dialog';
import { EnvironmentEnvImportModal } from '../environment-env-import-modal';
import { EnvironmentEnvVarsTable } from '../environment-env-vars-table';
import { SubtabShell } from './settings-subtab-shell';
import { buildEnvironmentRequirementSuggestions } from './settings-env-requirements.model';
import { SettingsVariableEditorModal } from './settings-variable-editor-modal';
import { SettingsVariableCollisionAlert } from './settings-variable-collision-alert';
import {
  findVariableBindingCollisions,
  upsertSecretReference,
} from './settings-variable-binding.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvVariablesTab(props: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  plainVariables: Record<string, string>;
  onPlainVariablesChange: (next: Record<string, string>) => void;
  secretReferences: EnvironmentConfigSecretReference[];
  onSecretReferencesChange: (next: EnvironmentConfigSecretReference[]) => void;
  resources: EnvironmentConfigResourceReference[];
  revision: EnvironmentConfigRevision | null;
  revisions: EnvironmentConfigRevision[];
  environments: ProjectEnvironment[];
}) {
  const t = useTranslations('projects');
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const importRestoreFocusRef = useRef<HTMLElement | null>(null);
  const copyRestoreFocusRef = useRef<HTMLElement | null>(null);
  const envCopy = useEnvironmentEnvCopy(props.environment.id);
  const project = props.detail.project;
  const persisted =
    props.revision?.plainVariables ?? plainVariablesFromEnvironment(props.environment);
  const diff = useMemo(
    () => diffEnvVars(persisted, props.plainVariables),
    [persisted, props.plainVariables],
  );
  const rows = Object.entries(props.plainVariables);
  const secrets = (project?.secretKeys ?? []).filter(
    (secret) => !secret.environment || secret.environment.id === props.environment.id,
  );
  const secretRefs = useMemo(
    () =>
      props.secretReferences.flatMap((reference) => {
        const secret = secrets.find((item) => item.id === reference.id);
        return secret ? [{ ...reference, name: secret.name, type: secret.type }] : [];
      }),
    [props.secretReferences, secrets],
  );
  const resourceInjections = useResourceInstanceInjections(
    project?.id ?? '',
    props.revision?.resourceReferences,
  );
  const suggestions = useMemo(
    () => buildEnvironmentRequirementSuggestions(project?.applications ?? [], props.environment.id),
    [project?.applications, props.environment.id],
  );
  if (!project) return null;
  const collisions = findVariableBindingCollisions(
    Object.keys(props.plainVariables),
    props.secretReferences,
    props.resources,
  );
  const updateRow = (oldKey: string, field: 'key' | 'value', value: string) => {
    props.onPlainVariablesChange(
      Object.fromEntries(
        rows.map(([key, current]) => [
          key === oldKey && field === 'key' ? value : key,
          key === oldKey && field === 'value' ? value : current,
        ]),
      ),
    );
  };
  const removeRow = (key: string) => {
    props.onPlainVariablesChange(Object.fromEntries(rows.filter(([item]) => item !== key)));
  };
  const addRow = () => {
    let index = 1;
    while (props.plainVariables[`NEW_KEY_${index}`] !== undefined) index += 1;
    props.onPlainVariablesChange({ ...props.plainVariables, [`NEW_KEY_${index}`]: '' });
  };
  return (
    <SubtabShell
      title={t('envTabVariables')}
      helper={t('envTabHelperVariables')}
      moduleHref={`/keys?projectId=${encodeURIComponent(project.id)}&environmentId=${encodeURIComponent(props.environment.id)}`}
      moduleLabel={t('envModuleLinkKeys')}
      actions={
        <SettingsVariableEditorModal
          rows={rows}
          saving={false}
          blockedReason={collisions.length ? t('configVariableCollisionBlocked') : undefined}
          suggestions={suggestions}
          secrets={secrets}
          references={props.secretReferences}
          revision={props.revision}
          onSetDraft={props.onPlainVariablesChange}
          onAdd={addRow}
          onRemove={removeRow}
          onUpdate={updateRow}
          onImportEnv={(restoreFocusTarget) => {
            importRestoreFocusRef.current = restoreFocusTarget;
            setImportOpen(true);
          }}
          onSave={async () => undefined}
          onReferencesChange={props.onSecretReferencesChange}
          onUsePlain={(key) => props.onPlainVariablesChange({ ...props.plainVariables, [key]: '' })}
          onUseSecret={(id, targetEnvKey) =>
            props.onSecretReferencesChange(
              upsertSecretReference(props.secretReferences, { id, targetEnvKey }),
            )
          }
          copyDisabled={rows.length === 0 && secretRefs.length === 0}
          onCopy={(restoreFocusTarget) => {
            copyRestoreFocusRef.current = restoreFocusTarget;
            setCopyOpen(true);
          }}
        />
      }
    >
      <div className="space-y-4">
        {diff.total > 0 ? (
          <Alert tone="warning">{t('configRevisionPlainVarsStaged', { count: diff.total })}</Alert>
        ) : null}
        <EnvironmentEnvVarsTable
          plainVars={props.plainVariables}
          secretRefs={secretRefs}
          committedSecretIds={
            new Set((props.revision?.secretReferences ?? []).map((ref) => ref.id))
          }
          resourceInjections={resourceInjections}
          t={t}
        />
        <SettingsVariableCollisionAlert collisions={collisions} />
        <EnvironmentConfigRevisionHistory
          revisions={props.revisions}
          t={t}
        />
        <EnvironmentEnvImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          existingKeys={new Set(Object.keys(persisted))}
          onImport={(incoming) =>
            props.onPlainVariablesChange({ ...props.plainVariables, ...incoming })
          }
          restoreFocusRef={importRestoreFocusRef}
          t={t}
        />
        <EnvironmentEnvCopyDialog
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          environments={props.environments}
          sourceEnvironment={props.environment}
          plainVars={props.plainVariables}
          secretRefs={secretRefs}
          copy={envCopy.copy}
          copying={envCopy.copying}
          onCopied={props.detail.loadProject}
          restoreFocusRef={copyRestoreFocusRef}
          t={t}
        />
      </div>
    </SubtabShell>
  );
}

function plainVariablesFromEnvironment(environment: ProjectEnvironment) {
  const source = environment.config?.envVars;
  if (!source || typeof source !== 'object') return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
