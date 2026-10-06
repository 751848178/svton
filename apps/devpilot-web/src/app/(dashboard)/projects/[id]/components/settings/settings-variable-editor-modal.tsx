'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { ProjectSecretKey } from '../../types';
import type {
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import { EnvironmentPlainVarsEditor } from '../environment-plain-vars-editor';
import { SettingsEnvRequirementSuggestions } from './settings-env-requirement-suggestions';
import type { EnvironmentRequirementSuggestion } from './settings-env-requirements.model';
import { SettingsSecretReferenceEditor } from './settings-secret-reference-editor';

interface Props {
  rows: Array<[string, string]>;
  saving: boolean;
  blockedReason?: string;
  suggestions: EnvironmentRequirementSuggestion[];
  secrets: ProjectSecretKey[];
  references: EnvironmentConfigSecretReference[];
  revision: EnvironmentConfigRevision | null;
  onSetDraft: (next: Record<string, string>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (oldKey: string, field: 'key' | 'value', value: string) => void;
  onImportEnv: (restoreFocusTarget: HTMLElement | null) => void;
  onSave: () => Promise<void>;
  onReferencesChange: (next: EnvironmentConfigSecretReference[]) => void;
  onUsePlain: (key: string) => void;
  onUseSecret: (id: string, targetEnvKey: string) => void;
  copyDisabled: boolean;
  onCopy: (restoreFocusTarget: HTMLElement | null) => void;
}

export function SettingsVariableEditorModal(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [plainSnapshot, setPlainSnapshot] = useState<Record<string, string>>({});
  const [secretSnapshot, setSecretSnapshot] = useState<EnvironmentConfigSecretReference[]>([]);
  const begin = (event: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    setPlainSnapshot(Object.fromEntries(props.rows));
    setSecretSnapshot(props.references);
    setOpen(true);
  };
  const cancel = () => {
    props.onSetDraft(plainSnapshot);
    props.onReferencesChange(secretSnapshot);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={begin}
      >
        {t('envVarsEditBindings')}
      </Button>
      <Modal
        open={open}
        onClose={cancel}
        title={t('envVarsEditBindings')}
        description={t('envVarsEditBindingsDescription')}
        width={880}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={props.copyDisabled}
              onClick={() => {
                setOpen(false);
                props.onCopy(triggerRef.current);
              }}
            >
              {t('envVarsCopyButton')}
            </Button>
            <Button
              variant="ghost"
              onClick={cancel}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('envVarsStageChanges')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <SettingsEnvRequirementSuggestions
            suggestions={props.suggestions}
            plainKeys={new Set(props.rows.map(([key]) => key))}
            secrets={props.secrets}
            selectedSecretIds={new Set(props.references.map((item) => item.id))}
            onUsePlain={props.onUsePlain}
            onUseSecret={props.onUseSecret}
          />
          <EnvironmentPlainVarsEditor
            rows={props.rows}
            saving={props.saving}
            onAdd={props.onAdd}
            onRemove={props.onRemove}
            onUpdate={props.onUpdate}
            onImportEnv={() => {
              setOpen(false);
              props.onImportEnv(triggerRef.current);
            }}
            onSave={props.onSave}
            blockedReason={props.blockedReason}
            showSaveAction={false}
            t={t}
          />
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">{t('configSecretReferences')}</h3>
            <SettingsSecretReferenceEditor
              secrets={props.secrets}
              references={props.references}
              currentRevision={props.revision}
              onChange={props.onReferencesChange}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
