import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import type { ContentBlock } from '../src/types';

// ==============================================================
// Helper — replicates the applyEnd logic from chat.service.ts
// for parsing tool result output into new ContentBlock types.
// ==============================================================

function parseToolResultToBlock(toolName: string, output: string): ContentBlock | null {
  // image_generate → image_generated block
  if (toolName === 'image_generate') {
    try {
      const parsed = JSON.parse(output);
      if (parsed.images || parsed.image) {
        const images = parsed.images || [parsed.image];
        return {
          type: 'image_generated',
          images: images.map((img: any) => ({
            url: img.url,
            base64: img.base64,
            revisedPrompt: img.revisedPrompt || img.revised_prompt,
          })),
          model: parsed.model || 'unknown',
        };
      }
    } catch {
      /* not JSON, skip */
    }
  }

  // csv_fanout → csv_fanout block
  if (toolName === 'csv_fanout') {
    try {
      const parsed = JSON.parse(output);
      if (parsed.totalRows !== undefined) {
        return {
          type: 'csv_fanout',
          totalRows: parsed.totalRows,
          succeeded: parsed.succeeded,
          failed: parsed.failed,
          rows: [],
        };
      }
    } catch {
      /* not JSON, skip */
    }
  }

  return null;
}

// ==============================================================
// Tests
// ==============================================================

describe('New ContentBlock types — Gap 12+13 fixes', () => {
  // ----------------------------------------------------------
  // 1. image_generated block
  // ----------------------------------------------------------
  describe('image_generated block', () => {
    it('parses image_generate output into image_generated block', () => {
      const output = JSON.stringify({
        images: [
          { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', revisedPrompt: 'A cat' },
        ],
        model: 'dall-e-3',
      });

      const block = parseToolResultToBlock('image_generate', output);

      expect(block).not.toBeNull();
      expect(block!.type).toBe('image_generated');
      if (block!.type === 'image_generated') {
        expect(block!.images).toHaveLength(1);
        expect(block!.images[0].base64).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB');
        expect(block!.images[0].revisedPrompt).toBe('A cat');
        expect(block!.model).toBe('dall-e-3');
      }
    });

    it('defaults model to unknown when not provided', () => {
      const output = JSON.stringify({
        images: [{ base64: 'abc123' }],
      });

      const block = parseToolResultToBlock('image_generate', output);

      expect(block).not.toBeNull();
      if (block!.type === 'image_generated') {
        expect(block!.model).toBe('unknown');
      }
    });

    it('handles snake_case revised_prompt key', () => {
      const output = JSON.stringify({
        images: [{ base64: 'abc', revised_prompt: 'A dog' }],
      });

      const block = parseToolResultToBlock('image_generate', output);

      expect(block).not.toBeNull();
      if (block!.type === 'image_generated') {
        expect(block!.images[0].revisedPrompt).toBe('A dog');
      }
    });

    it('supports single image field (not images array)', () => {
      const output = JSON.stringify({
        image: { base64: 'single', revisedPrompt: 'Single image' },
        model: 'test-model',
      });

      const block = parseToolResultToBlock('image_generate', output);

      expect(block).not.toBeNull();
      if (block!.type === 'image_generated') {
        expect(block!.images).toHaveLength(1);
        expect(block!.images[0].base64).toBe('single');
      }
    });

    it('returns null for non-JSON output', () => {
      const block = parseToolResultToBlock('image_generate', 'not json');
      expect(block).toBeNull();
    });

    it('returns null when no images field present', () => {
      const output = JSON.stringify({ model: 'dall-e-3' });
      const block = parseToolResultToBlock('image_generate', output);
      expect(block).toBeNull();
    });

    it('produces a valid ContentBlock type', () => {
      const output = JSON.stringify({ images: [{ base64: 'x' }], model: 'm' });
      const block = parseToolResultToBlock('image_generate', output);

      // Type narrowing check — TypeScript will fail compile if wrong
      const _typeCheck: ContentBlock = block!;
      expect(_typeCheck).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // 2. csv_fanout block
  // ----------------------------------------------------------
  describe('csv_fanout block', () => {
    it('parses csv_fanout output into csv_fanout block', () => {
      const output = JSON.stringify({
        totalRows: 100,
        succeeded: 95,
        failed: 5,
      });

      const block = parseToolResultToBlock('csv_fanout', output);

      expect(block).not.toBeNull();
      expect(block!.type).toBe('csv_fanout');
      if (block!.type === 'csv_fanout') {
        expect(block!.totalRows).toBe(100);
        expect(block!.succeeded).toBe(95);
        expect(block!.failed).toBe(5);
        expect(block!.rows).toEqual([]);
      }
    });

    it('handles zero rows', () => {
      const output = JSON.stringify({
        totalRows: 0,
        succeeded: 0,
        failed: 0,
      });

      const block = parseToolResultToBlock('csv_fanout', output);

      expect(block).not.toBeNull();
      if (block!.type === 'csv_fanout') {
        expect(block!.totalRows).toBe(0);
      }
    });

    it('returns null for non-JSON output', () => {
      const block = parseToolResultToBlock('csv_fanout', 'plain text');
      expect(block).toBeNull();
    });

    it('returns null when totalRows is missing', () => {
      const output = JSON.stringify({ succeeded: 5 });
      const block = parseToolResultToBlock('csv_fanout', output);
      expect(block).toBeNull();
    });

    it('produces a valid ContentBlock type', () => {
      const output = JSON.stringify({ totalRows: 1, succeeded: 1, failed: 0 });
      const block = parseToolResultToBlock('csv_fanout', output);

      const _typeCheck: ContentBlock = block!;
      expect(_typeCheck).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // 3. auto_review verdict
  // ----------------------------------------------------------
  describe('auto_review verdict', () => {
    it('can represent an approve verdict', () => {
      const block: ContentBlock = {
        type: 'auto_review',
        toolName: 'write_file',
        verdict: 'approve',
        reason: 'Safe write to project directory',
      };

      expect(block.type).toBe('auto_review');
      if (block.type === 'auto_review') {
        expect(block.verdict).toBe('approve');
        expect(block.toolName).toBe('write_file');
        expect(block.reason).toContain('Safe');
      }
    });

    it('can represent a deny verdict with ruleId', () => {
      const block: ContentBlock = {
        type: 'auto_review',
        toolName: 'bash',
        verdict: 'deny',
        reason: 'rm -rf is not allowed',
        ruleId: 'no-rm-rf',
      };

      if (block.type === 'auto_review') {
        expect(block.verdict).toBe('deny');
        expect(block.ruleId).toBe('no-rm-rf');
      }
    });

    it('can represent an ask_user verdict', () => {
      const block: ContentBlock = {
        type: 'auto_review',
        toolName: 'bash',
        verdict: 'ask_user',
        reason: 'Uncertain about command safety',
      };

      if (block.type === 'auto_review') {
        expect(block.verdict).toBe('ask_user');
        expect(block.ruleId).toBeUndefined();
      }
    });
  });

  // ----------------------------------------------------------
  // 4. code_review findings
  // ----------------------------------------------------------
  describe('code_review findings', () => {
    const findings = [
      { file: 'src/app.ts', line: 42, severity: 'error' as const, comment: 'Potential SQL injection' },
      { file: 'src/utils.ts', line: 10, severity: 'warning' as const, comment: 'Unused variable' },
      { file: 'src/index.ts', severity: 'info' as const, comment: 'Consider refactoring' },
    ];

    it('can hold structured findings with file/line/severity/comment', () => {
      const block: ContentBlock = {
        type: 'code_review',
        findings,
      };

      expect(block.type).toBe('code_review');
      if (block.type === 'code_review') {
        expect(block.findings).toHaveLength(3);
        expect(block.findings[0].file).toBe('src/app.ts');
        expect(block.findings[0].line).toBe(42);
        expect(block.findings[0].severity).toBe('error');
        expect(block.findings[0].comment).toBe('Potential SQL injection');
      }
    });

    it('supports all severity levels', () => {
      const severities = ['info', 'warning', 'error'] as const;

      severities.forEach((sev) => {
        const block: ContentBlock = {
          type: 'code_review',
          findings: [{ file: 'f.ts', severity: sev, comment: 'test' }],
        };

        if (block.type === 'code_review') {
          expect(block.findings[0].severity).toBe(sev);
        }
      });
    });

    it('supports findings without line number', () => {
      const block: ContentBlock = {
        type: 'code_review',
        findings: [{ file: 'README.md', severity: 'info', comment: 'Typo in docs' }],
      };

      if (block.type === 'code_review') {
        expect(block.findings[0].line).toBeUndefined();
      }
    });

    it('can hold an empty findings array', () => {
      const block: ContentBlock = {
        type: 'code_review',
        findings: [],
      };

      if (block.type === 'code_review') {
        expect(block.findings).toHaveLength(0);
      }
    });
  });

  // ----------------------------------------------------------
  // 5. Unknown tool names return null
  // ----------------------------------------------------------
  describe('unknown tools', () => {
    it('returns null for unrecognized tool name', () => {
      const block = parseToolResultToBlock('unknown_tool', '{"foo":"bar"}');
      expect(block).toBeNull();
    });

    it('returns null for empty tool name', () => {
      const block = parseToolResultToBlock('', '{}');
      expect(block).toBeNull();
    });
  });
});
