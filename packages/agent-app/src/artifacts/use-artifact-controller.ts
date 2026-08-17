import { useCallback, useRef, useState } from 'react';
import type {
  ArtifactHostAdapter,
  ArtifactIntent,
  ArtifactInteraction,
  ArtifactPanelRecord,
  ArtifactPanelState,
  ArtifactResult,
  ArtifactTarget,
} from '@svton/agent-ui';
import { isEditableArtifact } from '@svton/agent-ui';
import { useI18n } from '@svton/ui';
import { buildArtifactExportRequest } from './artifact-export.utils';
import {
  createArtifactRecord,
  reconcileArtifactRecord,
  saveArtifactDraft,
  updateArtifactDraft,
} from './artifact-panel.model';
import {
  cancelled,
  captureArtifactIntentFocus,
  currentArtifactOpener,
  restoreArtifactOpener,
  succeeded,
  UNSUPPORTED_ARTIFACT_HOST,
  unsupported,
  withArtifactResultId,
} from './artifact-controller.utils';

const MAX_ARTIFACT_RECORDS = 24;
const INITIAL_STATE: ArtifactPanelState = {
  active: null,
  confirmation: null,
  result: null,
  pending: false,
};

export function useArtifactController(adapter?: ArtifactHostAdapter): ArtifactInteraction {
  const { translate: t } = useI18n();
  const host = adapter ?? UNSUPPORTED_ARTIFACT_HOST;
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const confirmationOpener = useRef<HTMLElement | null>(null);
  const records = useRef(new Map<string, ArtifactPanelRecord>());
  const stateRef = useRef(INITIAL_STATE);
  const [state, setState] = useState(INITIAL_STATE);

  const publish = useCallback((next: ArtifactPanelState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const remember = useCallback((record: ArtifactPanelRecord) => {
    records.current.delete(record.target.id);
    records.current.set(record.target.id, record);
    while (records.current.size > MAX_ARTIFACT_RECORDS) {
      const oldest = records.current.keys().next().value as string | undefined;
      if (!oldest) break;
      records.current.delete(oldest);
    }
    return record;
  }, []);
  const activate = useCallback((target: ArtifactTarget) => {
    const existing = records.current.get(target.id);
    const record = remember(existing ? reconcileArtifactRecord(existing, target) : createArtifactRecord(target));
    publish({ ...stateRef.current, active: record, confirmation: null });
    return record;
  }, [publish, remember]);
  const presentOrActivate = useCallback(async (target: ArtifactTarget) => {
    const existing = records.current.get(target.id);
    const keepSessionDraftLocal = existing && existing.draftState !== 'clean';
    const presented = !keepSessionDraftLocal && isEditableArtifact(target) && host.presentEditable
      ? await host.presentEditable(target)
      : null;
    if (presented?.kind === 'succeeded') {
      publish({ ...stateRef.current, active: null, confirmation: null });
      return presented;
    }
    activate(target);
    return presented;
  }, [activate, host, publish]);
  const createOperationId = useCallback(
    () => `artifact-${Date.now().toString(36)}-${++sequence.current}`,
    [],
  );
  const captureOpener = useCallback(() => {
    opener.current = currentArtifactOpener() ?? opener.current;
  }, []);
  const restoreOpener = useCallback(() => {
    restoreArtifactOpener(opener.current);
  }, []);

  const updateDraft = useCallback((targetId: string, content: string) => {
    const current = records.current.get(targetId);
    if (!current) return;
    const record = remember(updateArtifactDraft(current, content));
    if (stateRef.current.active?.target.id === targetId) {
      publish({ ...stateRef.current, active: record, result: null });
    }
  }, [publish, remember]);

  const run = useCallback(async (intent: ArtifactIntent): Promise<ArtifactResult> => {
    const current = stateRef.current.active;
    if (intent.kind === 'artifact.result.dismiss') {
      publish({ ...stateRef.current, result: null });
      return cancelled(intent.id, t('artifact.result.dismissed'));
    }
    if (intent.kind === 'artifact.open') {
      if (current?.target.id === intent.target.id) {
        activate(intent.target);
        return succeeded(intent.id, t('artifact.result.panelPreserved'));
      }
      captureOpener();
      if (current?.draftState === 'dirty') {
        publish({ ...stateRef.current, confirmation: { kind: 'replace', nextTarget: intent.target } });
        return cancelled(intent.id, t('artifact.result.unsavedReplace'));
      }
      const presented = await presentOrActivate(intent.target);
      return presented ? withArtifactResultId(intent.id, presented) : succeeded(intent.id, t('artifact.result.opened'));
    }
    if (intent.kind === 'artifact.close') {
      if (!current || current.target.id !== intent.targetId) return cancelled(intent.id, t('artifact.result.alreadyClosed'));
      if (current.draftState === 'dirty') {
        publish({ ...stateRef.current, confirmation: { kind: 'close' } });
        return cancelled(intent.id, t('artifact.result.unsavedClose'));
      }
      publish({ ...stateRef.current, active: null, confirmation: null });
      restoreOpener();
      return succeeded(intent.id, t('artifact.result.closed'));
    }
    if (intent.kind === 'artifact.confirm.cancel') {
      publish({ ...stateRef.current, confirmation: null });
      restoreArtifactOpener(confirmationOpener.current);
      confirmationOpener.current = null;
      return cancelled(intent.id, t('artifact.result.changesKept'));
    }
    if (intent.kind === 'artifact.confirm.discard') {
      const confirmation = stateRef.current.confirmation;
      if (!confirmation) return cancelled(intent.id, t('artifact.result.noConfirmation'));
      if (current?.draftState === 'dirty') records.current.delete(current.target.id);
      if (confirmation.kind === 'replace') {
        const presented = await presentOrActivate(confirmation.nextTarget);
        return presented ? withArtifactResultId(intent.id, presented) : succeeded(intent.id, t('artifact.result.discardedAndOpened'));
      }
      else {
        publish({ ...stateRef.current, active: null, confirmation: null });
        restoreOpener();
      }
      return succeeded(intent.id, t('artifact.result.discarded'));
    }
    if (intent.kind === 'artifact.host.open') {
      const capability = host.resolveOpenCapability(intent.target);
      if (!capability.supported) return unsupported(intent.id, capability.reason);
      return withArtifactResultId(intent.id, await host.openReadonly(intent.target));
    }
    if (!current || current.target.id !== intent.targetId || !isEditableArtifact(current.target)) {
      return unsupported(intent.id, t('artifact.result.actionUnsupported'));
    }
    if (intent.kind === 'artifact.draft.save') {
      const record = remember(saveArtifactDraft(current));
      publish({ ...stateRef.current, active: record });
      return succeeded(intent.id, t('artifact.result.draftSaved'));
    }
    if (!host.exportCapability.supported) return unsupported(intent.id, host.exportCapability.reason);
    const request = buildArtifactExportRequest(current.target, current.draft ?? '');
    return withArtifactResultId(intent.id, await host.exportGenerated(request));
  }, [captureOpener, host, presentOrActivate, publish, remember, restoreOpener, t]);

  const dispatch = useCallback(async (intent: ArtifactIntent): Promise<ArtifactResult> => {
    if (inFlight.current) {
      const result = cancelled(intent.id, t('artifact.result.operationBusy'));
      publish({ ...stateRef.current, result });
      return result;
    }
    const focus = captureArtifactIntentFocus(intent, opener.current);
    opener.current = focus.opener;
    if (focus.confirmation !== undefined) confirmationOpener.current = focus.confirmation;
    inFlight.current = true;
    publish({ ...stateRef.current, pending: true, result: null });
    try {
      const result = await run(intent);
      publish({
        ...stateRef.current,
        pending: false,
        result: intent.kind === 'artifact.result.dismiss' ? null : result,
      });
      return result;
    } catch {
      const result: ArtifactResult = { id: intent.id, kind: 'failed', retryable: true, message: t('artifact.result.failed') };
      publish({ ...stateRef.current, pending: false, result });
      return result;
    } finally {
      inFlight.current = false;
    }
  }, [publish, run, t]);

  return { state, dispatch, createOperationId, updateDraft, resolveOpenCapability: host.resolveOpenCapability };
}
