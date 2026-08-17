import { cn, useI18n } from '@svton/ui';
import { DiffView, isDiff } from './DiffView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ScreenshotView, isImageOutput } from './ScreenshotView';
import {
  TOOL_OUTPUT_MAX_LINES,
  truncateToolOutput,
  type ToolCallPresentation,
} from './tool-call-card.utils';
import type { ToolCallInfo } from './tool-call-card.types';

export function ToolCallDetails({
  toolCall, view, expanded,
}: { toolCall: ToolCallInfo; view: ToolCallPresentation; expanded: boolean }) {
  const { translate: t } = useI18n();
  const output = toolCall.result?.output ?? '';
  if (!expanded) return <CollapsedToolResult toolCall={toolCall} view={view} output={output} />;
  const image = view.isScreenshotTool && isImageOutput(output);
  const markdown = output && !image && (output.includes('```') || /^#{1,6}\s/m.test(output));
  return (
    <div className="ml-4 mt-1 space-y-1.5">
      {view.isShell && view.shellCommand && <OutputShellCommand command={view.shellCommand} />}
      {view.isFileEdit && view.fileName && (
        <div className="text-xs text-muted-foreground"><span>File: </span><code>{view.fileName}</code></div>
      )}
      {!view.isShell && !view.isFileEdit && !view.isComputerUse && (
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground">{t('tool.parameters')}</div>
          <pre className="max-h-60 overflow-auto rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
      )}
      {toolCall.result && output && (
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground">
            {toolCall.result.isError ? t('tool.error') : t('tool.output')}
          </div>
          {image ? <ScreenshotView output={output} className="min-w-0 flex-1" />
            : isDiff(output) ? <DiffView diff={output} className="min-w-0 flex-1" />
              : markdown && !toolCall.result.isError
                ? <div className="max-h-80 overflow-auto rounded-md bg-muted px-3 py-1.5 text-xs"><MarkdownRenderer content={output} className="text-xs" /></div>
                : <ShellOutput output={output} isError={toolCall.result.isError} />}
        </div>
      )}
      {toolCall.status === 'pending_approval' && <div className="text-xs text-status-warning">{t('tool.pending')}</div>}
    </div>
  );
}

function CollapsedToolResult({
  toolCall, view, output,
}: { toolCall: ToolCallInfo; view: ToolCallPresentation; output: string }) {
  if (!toolCall.result || !output || view.isFileEdit) return null;
  if (!toolCall.result.isError && view.isScreenshotTool && isImageOutput(output)) {
    return <div className="mt-0.5 pl-4"><ScreenshotView output={output} className="max-h-16 max-w-[120px]" /></div>;
  }
  if (view.isScreenshotTool) return null;
  return <p className={cn('mt-0.5 line-clamp-1 pl-4 text-xs', toolCall.result.isError ? 'text-destructive' : 'text-muted-foreground')}>{output.slice(0, 120)}{output.length > 120 && '…'}</p>;
}

function OutputShellCommand({ command }: { command: string }) {
  return <pre className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-foreground">{command}</pre>;
}

function ShellOutput({ output, isError }: { output: string; isError?: boolean }) {
  const { text } = truncateToolOutput(output, TOOL_OUTPUT_MAX_LINES);
  return <pre className={cn('max-h-80 overflow-auto rounded-md border px-3 py-1.5 text-xs', isError ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted text-muted-foreground')}>{text}</pre>;
}
