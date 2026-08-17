import type {
  ArtifactPanelRecord,
  ArtifactTarget,
} from '@svton/agent-ui';
import { isEditableArtifact } from '@svton/agent-ui';

export function createArtifactRecord(target: ArtifactTarget): ArtifactPanelRecord {
  return isEditableArtifact(target)
    ? { target, baseline: target.content, draft: target.content, draftState: 'clean' }
    : { target, draftState: 'clean' };
}

export function reconcileArtifactRecord(
  record: ArtifactPanelRecord,
  target: ArtifactTarget,
): ArtifactPanelRecord {
  if (record.target.id !== target.id) return createArtifactRecord(target);
  if (!isEditableArtifact(target) || !isEditableArtifact(record.target)) {
    return { ...record, target };
  }
  if (record.draftState !== 'clean') {
    return { ...record, target: { ...target, content: record.baseline ?? target.content } };
  }
  return createArtifactRecord(target);
}

export function updateArtifactDraft(
  record: ArtifactPanelRecord,
  content: string,
): ArtifactPanelRecord {
  if (!isEditableArtifact(record.target)) return record;
  return {
    ...record,
    draft: content,
    draftState: content === record.baseline ? 'clean' : 'dirty',
  };
}

export function saveArtifactDraft(record: ArtifactPanelRecord): ArtifactPanelRecord {
  if (!isEditableArtifact(record.target)) return record;
  return { ...record, baseline: record.draft ?? '', draftState: 'saved' };
}
