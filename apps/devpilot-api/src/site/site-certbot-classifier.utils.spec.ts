import {
  classifyCertbotRenewOutput,
  fallbackSummary,
  selectSummaryLine,
} from './site-certbot-classifier.utils';

describe('classifyCertbotRenewOutput', () => {
  describe('exit code as primary signal (executionStatus provided)', () => {
    it('treats executionStatus=completed with empty stdout as succeeded (not unknown)', () => {
      // 修复前：空 stdout + completed 落到 unknown/failed；exit 0 明确表示无失败，应为 succeeded
      const result = classifyCertbotRenewOutput('', 'completed');
      expect(result.status).toBe('succeeded');
      expect(result.attempted).toBe(true);
    });

    it('treats executionStatus=completed with non-English locale stdout as succeeded', () => {
      // locale 切换后 stdout 关键词匹配不到，但 exit 0 仍是可靠信号
      const result = classifyCertbotRenewOutput('恭喜！证书已成功续期。', 'completed');
      expect(result.status).toBe('succeeded');
    });

    it('classifies not_due when stdout signals skip under exit 0', () => {
      const result = classifyCertbotRenewOutput(
        'No renewals were attempted.',
        'completed',
      );
      expect(result.status).toBe('not_due');
      expect(result.attempted).toBe(false);
    });

    it('classifies failed when executionStatus=failed (exit != 0)', () => {
      const result = classifyCertbotRenewOutput('some output', 'failed');
      expect(result.status).toBe('failed');
      expect(result.attempted).toBe(true);
    });

    it('defensively marks failed when exit 0 but stdout contains error keywords', () => {
      const result = classifyCertbotRenewOutput(
        'Error: unable to renew certificate',
        'completed',
      );
      expect(result.status).toBe('failed');
    });

    it('extracts congratulations summary under exit 0', () => {
      const result = classifyCertbotRenewOutput(
        'Processing...\nCongratulations! Renewal succeeded.',
        'completed',
      );
      expect(result.status).toBe('succeeded');
      expect(result.summary).toContain('Congratulations');
    });
  });

  describe('fallback when executionStatus absent (defensive)', () => {
    it('falls back to stdout regex for succeeded', () => {
      const result = classifyCertbotRenewOutput(
        'All renewals succeeded.',
        undefined,
      );
      expect(result.status).toBe('succeeded');
    });

    it('falls back to stdout regex for not_due', () => {
      const result = classifyCertbotRenewOutput(
        'No renewals were attempted.',
        undefined,
      );
      expect(result.status).toBe('not_due');
    });

    it('falls back to stdout regex for failed', () => {
      const result = classifyCertbotRenewOutput(
        'Error: could not renew.',
        undefined,
      );
      expect(result.status).toBe('failed');
    });

    it('returns unknown when no signal at all', () => {
      const result = classifyCertbotRenewOutput('random output', undefined);
      expect(result.status).toBe('unknown');
      expect(result.attempted).toBe(false);
    });
  });

  describe('selectSummaryLine', () => {
    it('returns first matching keyword line', () => {
      const line = selectSummaryLine('noise\nSuccessfully renewed cert\nmore', [
        'successfully renewed',
      ]);
      expect(line).toBe('Successfully renewed cert');
    });

    it('returns first non-empty line when no keywords match', () => {
      expect(selectSummaryLine('first line\nsecond', [])).toBe('first line');
    });

    it('truncates long summaries to 240 chars', () => {
      const long = 'x'.repeat(300);
      const result = selectSummaryLine(long, []);
      expect(result?.length).toBe(240);
      expect(result?.endsWith('...')).toBe(true);
    });
  });

  describe('fallbackSummary', () => {
    it('builds a readable summary for each status', () => {
      expect(fallbackSummary('succeeded', false)).toContain('succeeded');
      expect(fallbackSummary('succeeded', true)).toContain('dry-run');
      expect(fallbackSummary('not_due', false)).toContain('not due');
      expect(fallbackSummary('failed', false)).toContain('failed');
      expect(fallbackSummary('unknown', false)).toContain('unknown');
    });
  });
});
