'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { Project, ProjectEnvironment } from '../../types';
import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import { EnvironmentConfigResourceEditor } from '../environment-config-resource-editor';

export function SettingsResourceBindingModal(props: {
  project: Project;
  environment: ProjectEnvironment;
  value: EnvironmentConfigResourceReference[];
  currentReferences: EnvironmentConfigResourceReference[];
  onChange: (next: EnvironmentConfigResourceReference[]) => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const begin = () => {
    setDraft(props.value);
    setOpen(true);
  };
  const apply = () => {
    props.onChange(draft);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={begin}
      >
        {t('envResourceEditBindings')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('envResourceEditBindings')}
        description={t('envResourceEditBindingsDescription', {
          environment: props.environment.name,
        })}
        width={760}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={apply}>{t('envResourceApplyBindings')}</Button>
          </>
        }
      >
        <EnvironmentConfigResourceEditor
          project={props.project}
          environment={props.environment}
          value={draft}
          onChange={setDraft}
          currentReferences={props.currentReferences}
        />
      </Modal>
    </>
  );
}
