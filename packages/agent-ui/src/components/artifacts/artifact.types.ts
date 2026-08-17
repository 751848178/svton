export interface ArtifactChange {
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  diff?: string;
}

export type EditableArtifactTarget =
  | { kind: 'document'; id: string; title: string; format: 'markdown' | 'text' | 'html'; content: string }
  | { kind: 'code'; id: string; title: string; language?: string; content: string };

export type ReadonlyArtifactTarget =
  | { kind: 'file'; id: string; path: string; line?: number; column?: number; source: 'tree' | 'review' | 'change' }
  | { kind: 'reference'; id: string; path: string; line?: number; column?: number; snippet?: string }
  | { kind: 'diff'; id: string; title: string; changes: ArtifactChange[]; focusPath?: string };

export type ArtifactTarget = EditableArtifactTarget | ReadonlyArtifactTarget;

export type ArtifactIntent =
  | { id: string; kind: 'artifact.open'; target: ArtifactTarget }
  | { id: string; kind: 'artifact.draft.save'; targetId: string }
  | { id: string; kind: 'artifact.export'; targetId: string }
  | { id: string; kind: 'artifact.host.open'; target: Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }> }
  | { id: string; kind: 'artifact.close'; targetId: string }
  | { id: string; kind: 'artifact.confirm.discard' }
  | { id: string; kind: 'artifact.confirm.cancel' }
  | { id: string; kind: 'artifact.result.dismiss' };

export type ArtifactResult =
  | { id: string; kind: 'succeeded'; message: string }
  | { id: string; kind: 'unsupported'; message: string }
  | { id: string; kind: 'failed'; message: string; retryable: boolean }
  | { id: string; kind: 'cancelled'; message: string };

export type ArtifactCapability =
  | { supported: true }
  | { supported: false; reason: string };

export interface ArtifactExportRequest {
  targetId: string;
  filename: string;
  mimeType: string;
  content: string;
}

export type ArtifactHostResult =
  | { kind: 'succeeded'; message: string }
  | { kind: 'unsupported'; message: string }
  | { kind: 'failed'; message: string; retryable: boolean }
  | { kind: 'cancelled'; message: string };

export interface ArtifactHostAdapter {
  exportCapability: ArtifactCapability;
  exportGenerated: (request: ArtifactExportRequest) => Promise<ArtifactHostResult>;
  presentEditable?: (target: EditableArtifactTarget) => Promise<ArtifactHostResult | null>;
  resolveOpenCapability: (target: Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }>) => ArtifactCapability;
  openReadonly: (target: Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }>) => Promise<ArtifactHostResult>;
}

export interface ArtifactPanelRecord {
  target: ArtifactTarget;
  baseline?: string;
  draft?: string;
  draftState: 'clean' | 'dirty' | 'saved';
}

export type ArtifactConfirmation =
  | { kind: 'close' }
  | { kind: 'replace'; nextTarget: ArtifactTarget };

export interface ArtifactPanelState {
  active: ArtifactPanelRecord | null;
  confirmation: ArtifactConfirmation | null;
  result: ArtifactResult | null;
  pending: boolean;
}

export interface ArtifactInteraction {
  state: ArtifactPanelState;
  createOperationId: () => string;
  dispatch: (intent: ArtifactIntent) => Promise<ArtifactResult>;
  updateDraft: (targetId: string, content: string) => void;
  resolveOpenCapability: ArtifactHostAdapter['resolveOpenCapability'];
}

export function isEditableArtifact(target: ArtifactTarget): target is EditableArtifactTarget {
  return target.kind === 'document' || target.kind === 'code';
}
