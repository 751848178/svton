import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronIcon, cn, useI18n } from '@svton/ui';
import { ArtifactDirtyDialog } from './ArtifactDirtyDialog';
import { ArtifactEditableView } from './ArtifactEditableView';
import { ArtifactReadonlyView } from './ArtifactReadonlyView';
import { useInert } from '../use-inert';
import type { ArtifactInteraction, ArtifactTarget } from './artifact.types';
import { isEditableArtifact } from './artifact.types';

export function ArtifactPanel({ interaction, className, closePresentation = 'close' }: {
  interaction: ArtifactInteraction;
  className?: string;
  closePresentation?: 'back' | 'close';
}) {
  const { translate: t } = useI18n();
  const { active, confirmation, pending, result } = interaction.state;
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const previewTabId = `${id}-preview-tab`;
  const previewPanelId = `${id}-preview-panel`;
  const editTabId = `${id}-edit-tab`;
  const editPanelId = `${id}-edit-panel`;
  useInert(panelBodyRef, Boolean(confirmation));

  useEffect(() => {
    setMode('preview');
    headingRef.current?.focus();
  }, [active?.target.id]);
  if (!active) return null;

  const editable = isEditableArtifact(active.target);
  const dispatch = (kind: 'artifact.draft.save' | 'artifact.export' | 'artifact.close') => interaction.dispatch({
    id: interaction.createOperationId(), kind, targetId: active.target.id,
  });
  const status = active.draftState === 'dirty'
    ? t('artifact.state.dirty')
    : active.draftState === 'saved' ? t('artifact.state.saved') : t('artifact.state.clean');
  const selectTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const destinations: Record<string, number> = {
      ArrowLeft: (index + 1) % 2,
      ArrowRight: (index + 1) % 2,
      Home: 0,
      End: 1,
    };
    const next = destinations[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setMode(next === 0 ? 'preview' : 'edit');
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      aria-label={t('artifact.panel.label')}
      data-artifact-panel
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || confirmation) return;
        event.preventDefault();
        void dispatch('artifact.close');
      }}
      className={cn('relative flex h-full min-h-0 flex-col border-l border-[#383838] bg-[#242424]', className)}
    >
      <div ref={panelBodyRef} aria-hidden={confirmation ? true : undefined} className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[#383838] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 ref={headingRef} data-artifact-heading tabIndex={-1} className="min-w-0 flex-1 truncate text-sm font-medium text-gray-100">{titleFor(active.target)}</h2>
          <span className="rounded bg-[#333] px-2 py-1 text-[10px] uppercase text-gray-400">{t(artifactTypeKey(active.target.kind))}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => void dispatch('artifact.close')}
            aria-label={t(closePresentation === 'back' ? 'artifact.close.backLabel' : 'artifact.close.label')}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-gray-300 hover:bg-[#303030]"
          >
            {closePresentation === 'back' && (
              <ChevronIcon size={16} aria-hidden="true" className="rotate-180" />
            )}
            {t(closePresentation === 'back' ? 'artifact.close.back' : 'artifact.close.action')}
          </button>
        </div>
        {editable && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={t('artifact.tabs.label')} className="flex rounded-lg border border-[#404040] p-0.5">
              <button ref={(node) => { tabRefs.current[0] = node; }} id={previewTabId} role="tab" tabIndex={mode === 'preview' ? 0 : -1} aria-selected={mode === 'preview'} aria-controls={previewPanelId} type="button" onKeyDown={(event) => selectTab(event, 0)} onClick={() => setMode('preview')} className={tabClass(mode === 'preview')}>{t('artifact.tabs.preview')}</button>
              <button ref={(node) => { tabRefs.current[1] = node; }} id={editTabId} role="tab" tabIndex={mode === 'edit' ? 0 : -1} aria-selected={mode === 'edit'} aria-controls={editPanelId} type="button" onKeyDown={(event) => selectTab(event, 1)} onClick={() => setMode('edit')} className={tabClass(mode === 'edit')}>{t('artifact.tabs.edit')}</button>
            </div>
            <span className={cn('text-xs', active.draftState === 'dirty' ? 'text-amber-300' : 'text-gray-500')}>{status}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" disabled={pending || active.draftState !== 'dirty'} onClick={() => void dispatch('artifact.draft.save')} className="min-h-11 rounded-lg border border-[#454545] px-3 text-xs text-gray-200 hover:bg-[#303030] disabled:opacity-50">{t('artifact.saveDraft')}</button>
              <button type="button" disabled={pending} onClick={() => void dispatch('artifact.export')} className="min-h-11 rounded-lg bg-gray-100 px-3 text-xs text-gray-900 hover:bg-white disabled:opacity-50">{t('artifact.export')}</button>
            </div>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {isEditableArtifact(active.target)
          ? <ArtifactEditableView target={active.target} draft={active.draft ?? ''} mode={mode} onChange={(value) => interaction.updateDraft(active.target.id, value)} previewTabId={previewTabId} previewPanelId={previewPanelId} editTabId={editTabId} editPanelId={editPanelId} />
          : <ArtifactReadonlyView target={active.target} interaction={interaction} />}
      </div>
      <div aria-live="polite" aria-atomic="true" className="min-h-8 border-t border-[#383838] px-4 py-2 text-xs text-gray-400">
        {pending ? t('artifact.processing') : result?.message}
      </div>
      </div>
      {confirmation && (
        <ArtifactDirtyDialog
          confirmation={confirmation}
          returnFocusRef={confirmation.kind === 'close' ? closeRef : undefined}
          onCancel={() => void interaction.dispatch({ id: interaction.createOperationId(), kind: 'artifact.confirm.cancel' })}
          onDiscard={() => void interaction.dispatch({ id: interaction.createOperationId(), kind: 'artifact.confirm.discard' })}
        />
      )}
    </section>
  );
}

function titleFor(target: ArtifactTarget): string {
  if (target.kind === 'document' || target.kind === 'code' || target.kind === 'diff') return target.title;
  return target.path;
}
function artifactTypeKey(kind: ArtifactTarget['kind']) {
  if (kind === 'document') return 'artifact.type.document' as const;
  if (kind === 'code') return 'artifact.type.code' as const;
  if (kind === 'file') return 'artifact.type.file' as const;
  if (kind === 'reference') return 'artifact.type.reference' as const;
  return 'artifact.type.diff' as const;
}
function tabClass(active: boolean) {
  return cn('min-h-11 rounded-md px-3 text-xs', active ? 'bg-[#3a3a3a] text-gray-100' : 'text-gray-400 hover:text-gray-200');
}
