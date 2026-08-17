import { cn } from '@svton/ui';
import type { SplitScreenContent } from './split-screen.types';

export function SplitScreenHeader({
  content, mode, readOnly, onModeChange, onExport, onClose,
}: {
  content: SplitScreenContent;
  mode: 'preview' | 'edit';
  readOnly: boolean;
  onModeChange: (mode: 'preview' | 'edit') => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const textContent = content.type === 'document' || content.type === 'code';
  return (
    <div className="flex items-center justify-between border-b border-[#383838] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-gray-200">{content.title}</span>
        <span className="flex-shrink-0 rounded bg-[#333] px-2 py-1 text-[10px] font-medium uppercase text-gray-400">
          {contentTypeLabel(content)}
        </span>
        {readOnly && <span className="text-[11px] text-gray-500">只读预览</span>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {textContent && !readOnly && (
          <div className="flex rounded-lg bg-[#2a2a2a] p-0.5">
            <button type="button" onClick={() => onModeChange('preview')} className={modeClass(mode === 'preview')}>Preview</button>
            <button type="button" onClick={() => onModeChange('edit')} className={modeClass(mode === 'edit')}>Edit</button>
          </div>
        )}
        {textContent && !readOnly && (
          <button type="button" onClick={onExport} className="min-h-11 rounded-lg px-3 text-xs text-gray-400 hover:bg-[#303030] hover:text-gray-200">Export</button>
        )}
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 text-xs text-gray-400 hover:bg-[#303030] hover:text-gray-200">Close</button>
      </div>
    </div>
  );
}

function contentTypeLabel(content: SplitScreenContent): string {
  if (content.type === 'code') return content.language || 'CODE';
  if (content.type === 'pdf') return 'PDF';
  if (content.type === 'image') return 'IMG';
  if (content.type === 'preview_images') return 'PREVIEW';
  return 'MD';
}

function modeClass(active: boolean): string {
  return cn(
    'min-h-11 rounded-md px-3 text-[11px] font-medium transition-colors',
    active ? 'bg-[#333] text-gray-200' : 'text-gray-500 hover:text-gray-300',
  );
}
