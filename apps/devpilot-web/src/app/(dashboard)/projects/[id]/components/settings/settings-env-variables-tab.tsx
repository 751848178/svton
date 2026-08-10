/** 编排变量需求、普通变量、Secret/资源映射与修订化保存。 */
'use client';

import React, { useMemo } from 'react';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { useResourceInstanceInjections } from '../../hooks/use-resource-instance-injections';
import { useSettingsEnvVariableWorkflow } from '../../hooks/use-settings-env-variable-workflow';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import { EnvironmentEnvVarsTable } from '../environment-env-vars-table';
import { EnvironmentPlainVarsEditor } from '../environment-plain-vars-editor';
import { EnvironmentStagedBanner } from '../environment-staged-banner';
import { SubtabShell } from './settings-subtab-shell';
import { SettingsEnvRequirementSuggestions } from './settings-env-requirement-suggestions';
import { buildEnvironmentRequirementSuggestions } from './settings-env-requirements.model';
import { SettingsEnvVariableModals } from './settings-env-variable-modals';
import { SettingsSecretReferenceEditor } from './settings-secret-reference-editor';
import { SettingsVariableCollisionAlert } from './settings-variable-collision-alert';
import {
  findVariableBindingCollisions,
  upsertSecretReference,
} from './settings-variable-binding.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvVariablesTab({
  environment,
  detail,
  secretReferences,
  onSecretReferencesChange,
  resources,
  revision,
  revisions,
  environments,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  secretReferences: EnvironmentConfigSecretReference[];
  onSecretReferencesChange: (next: EnvironmentConfigSecretReference[]) => void;
  resources: EnvironmentConfigResourceReference[];
  revision: EnvironmentConfigRevision | null;
  revisions: EnvironmentConfigRevision[];
  environments: ProjectEnvironment[];
}) {
  const t = useTranslations('projects');
  const project = detail.project;

  const workflow = useSettingsEnvVariableWorkflow(environment, detail.loadProject, t);
  const { vars, draft, saving, save, copying, copy, diff, deploying } = workflow;
  const rows = Object.entries(draft);

  const secrets = (project?.secretKeys ?? []).filter(
    (secret) => !secret.environment || secret.environment.id === environment.id,
  );
  const secretRefs = useMemo(
    () => secretReferences.flatMap((reference) => {
      const secret = secrets.find((item) => item.id === reference.id);
      return secret ? [{ ...reference, name: secret.name, type: secret.type }] : [];
    }),
    [secrets, secretReferences],
  );
  const committedSecretIds = useMemo(
    () => new Set((revision?.secretReferences ?? []).map((ref) => ref.id)),
    [revision],
  );
  const resourceInjections = useResourceInstanceInjections(
    project?.id ?? '',
    revision?.resourceReferences,
  );
  const requirementSuggestions = useMemo(
    () => buildEnvironmentRequirementSuggestions(project?.applications ?? [], environment.id),
    [environment.id, project?.applications],
  );

  if (!project) return null;

  const projectId = project.id;
  const keysManageHref = `/keys?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environment.id)}`;

  const collisions = findVariableBindingCollisions(Object.keys(draft), secretReferences, resources);

  return (
    <SubtabShell
      title={t('envTabVariables')}
      helper={t('envTabHelperVariables')}
      moduleHref={keysManageHref}
      moduleLabel={t('envModuleLinkKeys')}
    >      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('envVarsSnapshotCallout')}
        </p>

        <SettingsEnvRequirementSuggestions
          suggestions={requirementSuggestions}
          plainKeys={new Set(Object.keys(draft))}
          secrets={secrets}
          selectedSecretIds={new Set(secretReferences.map((item) => item.id))}
          onUsePlain={(key) => workflow.mergeDraft({ [key]: '' })}
          onUseSecret={(id, targetEnvKey) => onSecretReferencesChange(upsertSecretReference(
            secretReferences,
            { id, targetEnvKey },
          ))}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('envVarsTableTitle')}
          </h4>
          {revision ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              {t('envVarsCurrentBadge', { revision: revision.revision })}
            </span>
          ) : null}
        </div>

        <EnvironmentEnvVarsTable
          plainVars={draft}
          secretRefs={secretRefs}
          committedSecretIds={committedSecretIds}
          resourceInjections={resourceInjections}
          t={t}
        />

        <SettingsVariableCollisionAlert collisions={collisions} />

        <EnvironmentStagedBanner
          pendingCount={diff.total}
          onReview={() => workflow.setReviewOpen(true)}
          onDiscard={workflow.discard}
          t={t}
        />

        <EnvironmentPlainVarsEditor
          rows={rows}
          saving={saving || deploying}
          onAdd={workflow.addRow}
          onRemove={workflow.removeRow}
          onUpdate={workflow.updateRow}
          onImportEnv={() => workflow.setImportOpen(true)}
          onSave={save}
          blockedReason={collisions.length > 0 ? t('configVariableCollisionBlocked') : undefined}
          t={t}
        />

        <div className="space-y-1">
          <div className="text-xs font-medium">{t('configSecretReferences')}</div>
          <SettingsSecretReferenceEditor
            secrets={secrets}
            references={secretReferences}
            currentRevision={revision}
            onChange={onSecretReferencesChange}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => workflow.setCopyOpen(true)}
            disabled={rows.length === 0 && secretRefs.length === 0}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {t('envVarsCopyButton')}
          </button>
        </div>

        <SettingsEnvVariableModals
          revisions={revisions}
          importOpen={workflow.importOpen}
          setImportOpen={workflow.setImportOpen}
          reviewOpen={workflow.reviewOpen}
          setReviewOpen={workflow.setReviewOpen}
          copyOpen={workflow.copyOpen}
          setCopyOpen={workflow.setCopyOpen}
          vars={vars}
          draft={draft}
          changes={diff.changes}
          deploying={deploying}
          environments={environments}
          environment={environment}
          secretRefs={secretRefs}
          copying={copying}
          onImport={workflow.importVars}
          onDeploy={collisions.length === 0 ? workflow.deploy : async () => undefined}
          copy={copy}
          onCopied={detail.loadProject}
          t={t}
        />
      </div>
    </SubtabShell>
  );
}
