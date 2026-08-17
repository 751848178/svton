import { describe, expect, it } from 'vitest';
import type { EditableArtifactTarget } from '@svton/agent-ui';
import {
  createArtifactRecord,
  reconcileArtifactRecord,
  saveArtifactDraft,
  updateArtifactDraft,
} from '../src/artifacts/artifact-panel.model';
import { buildArtifactExportRequest } from '../src/artifacts/artifact-export.utils';

const documentTarget = (content: string): EditableArtifactTarget => ({
  kind: 'document', id: 'message-1:block-2:document', title: 'Contract', format: 'markdown', content,
});

describe('artifact panel model', () => {
  it('refreshes a clean same-id source but never resets dirty or saved session state', () => {
    const clean = createArtifactRecord(documentTarget('source-a'));
    expect(reconcileArtifactRecord(clean, documentTarget('source-b')).draft).toBe('source-b');

    const dirty = updateArtifactDraft(clean, 'local edit');
    expect(reconcileArtifactRecord(dirty, documentTarget('source-b'))).toMatchObject({
      baseline: 'source-a', draft: 'local edit', draftState: 'dirty',
    });

    const saved = saveArtifactDraft(dirty);
    expect(reconcileArtifactRecord(saved, documentTarget('source-c'))).toMatchObject({
      baseline: 'local edit', draft: 'local edit', draftState: 'saved',
    });
  });

  it('exports the current draft with a deterministic safe filename', () => {
    const request = buildArtifactExportRequest(
      { ...documentTarget('source'), title: '../Release: notes?' },
      'current draft',
    );
    expect(request).toMatchObject({ content: 'current draft', filename: 'Release-notes.md', mimeType: 'text/markdown;charset=utf-8' });
  });
});
