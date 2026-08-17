import { detectDocumentContent } from './DocumentCard';
import { DocumentCard } from './DocumentCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ArtifactTarget } from '../artifacts/artifact.types';

export function AssistantTextBlock({
  text, messageId, blockId, streaming, canOpenArtifact, onArtifactOpen,
}: {
  text: string;
  messageId: string;
  blockId: string;
  streaming?: boolean;
  canOpenArtifact: boolean;
  onArtifactOpen: (target: ArtifactTarget) => void;
}) {
  const document = !streaming && canOpenArtifact ? detectDocumentContent(text) : null;
  if (streaming) {
    return <div className="min-w-0 break-words text-sm leading-relaxed text-foreground"><MarkdownRenderer content={text} /><span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-text-bottom motion-reduce:animate-none" /></div>;
  }
  if (document) {
    return <DocumentCard title={document.title} snippet={document.snippet} kind={document.kind} extension={document.extension} onClick={() => onArtifactOpen({ kind: 'document', id: `${messageId}:${blockId}:document`, title: document.title, format: 'markdown', content: text })} />;
  }
  return <div className="min-w-0 break-words text-sm leading-relaxed text-foreground"><MarkdownRenderer content={text} artifactId={`${messageId}:${blockId}`} onArtifactOpen={canOpenArtifact ? onArtifactOpen : undefined} /></div>;
}
