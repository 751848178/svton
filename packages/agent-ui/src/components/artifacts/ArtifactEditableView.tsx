import { CodeBlock } from '../chat/CodeBlock';
import { LivePreview, supportsLivePreview } from '../chat/LivePreview';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import { useI18n } from '@svton/ui';
import type { EditableArtifactTarget } from './artifact.types';

export function ArtifactEditableView({
  target, draft, mode, onChange,
  previewTabId, previewPanelId, editTabId, editPanelId,
}: {
  target: EditableArtifactTarget;
  draft: string;
  mode: 'preview' | 'edit';
  onChange: (content: string) => void;
  previewTabId: string;
  previewPanelId: string;
  editTabId: string;
  editPanelId: string;
}) {
  const { formatNumber, translate: t } = useI18n();
  const characterCount = Array.from(draft).length;
  if (mode === 'edit') {
    return (
      <div role="tabpanel" id={editPanelId} aria-labelledby={editTabId} className="flex h-full min-h-0 flex-col">
        <label htmlFor={`${editPanelId}-editor`} className="sr-only">{t('artifact.editable.label', { title: target.title })}</label>
        <textarea
          id={`${editPanelId}-editor`}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={target.kind === 'document'}
          className="min-h-0 flex-1 resize-none bg-[#171717] p-4 font-mono text-sm leading-6 text-gray-200 outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-700"
        />
        <p className="border-t border-[#383838] px-4 py-2 text-[11px] text-gray-500">{t(characterCount === 1 ? 'artifact.charactersOne' : 'artifact.characters', { count: formatNumber(characterCount) })}</p>
      </div>
    );
  }

  return (
    <div role="tabpanel" id={previewPanelId} aria-labelledby={previewTabId} className="h-full overflow-auto p-5">
      {target.kind === 'document'
        ? <MarkdownRenderer content={draft} />
        : supportsLivePreview(draft, target.language)
          ? <LivePreview code={draft} language={target.language} className="my-0" />
          : (
            <div>
              <p className="mb-3 text-xs text-gray-500">{t('artifact.sourcePreviewUnsupported')}</p>
              <CodeBlock code={draft} language={target.language} highlight />
            </div>
          )}
    </div>
  );
}
