'use client';

import React from 'react';
import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import type { EnvironmentVersionCandidate } from '../../types/environment-version.types';
import { VersionRowPanel, type VersionPanelKind } from './environment-version-row-panels';

export function EnvironmentVersionRowDialog(props: {
  item?: EnvironmentVersionCandidate;
  panel?: VersionPanelKind;
  onClose: () => void;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const titleKey =
    props.panel === 'changes'
      ? 'viewVersionChanges'
      : props.panel === 'evidence'
        ? 'releaseOrderActionEvidence'
        : 'viewVersionDetails';
  return (
    <Modal
      open={Boolean(props.item && props.panel)}
      onClose={props.onClose}
      title={t(titleKey)}
      ariaCloseLabel={tc('close')}
      restoreFocusRef={props.restoreFocusRef}
    >
      {props.item && props.panel ? (
        <VersionRowPanel
          item={props.item}
          panel={props.panel}
        />
      ) : null}
    </Modal>
  );
}
