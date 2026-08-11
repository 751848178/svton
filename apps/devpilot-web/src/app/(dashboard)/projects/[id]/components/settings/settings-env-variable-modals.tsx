'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { EnvCopyTarget } from '../../hooks/use-environment-env-copy';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { EnvVarChange } from '../../utils/env-var-diff.utils';
import { EnvironmentConfigRevisionHistory } from '../environment-config-revision-history';
import { EnvironmentEnvCopyDialog } from '../environment-env-copy-dialog';
import { EnvironmentEnvImportModal } from '../environment-env-import-modal';
import { EnvironmentEnvReviewModal } from '../environment-env-review-modal';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function SettingsEnvVariableModals(props: {
  revisions: EnvironmentConfigRevision[];
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  copyOpen: boolean;
  setCopyOpen: (open: boolean) => void;
  vars: Record<string, string>;
  draft: Record<string, string>;
  changes: EnvVarChange[];
  deploying: boolean;
  environments: ProjectEnvironment[];
  environment: ProjectEnvironment;
  secretRefs: Array<{ id: string; name: string; type: string }>;
  copying: boolean;
  onImport: (incoming: Record<string, string>) => void;
  onDeploy: () => Promise<void>;
  copy: (input: {
    targets: EnvCopyTarget[];
    plainVariables: Record<string, string>;
    secretReferenceIds: string[];
    changeSummary?: string;
  }) => Promise<unknown>;
  onCopied: () => void;
  t: ProjectsTranslator;
}) {
  return (
    <>
      <EnvironmentConfigRevisionHistory revisions={props.revisions} t={props.t} />
      <EnvironmentEnvImportModal
        open={props.importOpen}
        onClose={() => props.setImportOpen(false)}
        existingKeys={new Set(Object.keys(props.vars))}
        onImport={props.onImport}
        t={props.t}
      />
      <EnvironmentEnvReviewModal
        open={props.reviewOpen}
        onClose={() => props.setReviewOpen(false)}
        changes={props.changes}
        deploying={props.deploying}
        onDeploy={props.onDeploy}
        t={props.t}
      />
      <EnvironmentEnvCopyDialog
        open={props.copyOpen}
        onClose={() => props.setCopyOpen(false)}
        environments={props.environments}
        sourceEnvironment={props.environment}
        plainVars={props.draft}
        secretRefs={props.secretRefs}
        copy={props.copy}
        copying={props.copying}
        onCopied={props.onCopied}
        t={props.t}
      />
    </>
  );
}
