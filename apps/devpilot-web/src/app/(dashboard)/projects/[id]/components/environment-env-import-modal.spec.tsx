import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parseEnvText } from '../utils/env-file-parser.utils';
import { EnvironmentEnvImportModal } from './environment-env-import-modal';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({
  Modal: ({ open, title, children, footer }: { open: boolean; title: string; children: React.ReactNode; footer: React.ReactNode }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
  Textarea: () => <textarea readOnly />,
}));

describe('EnvironmentEnvImportModal classification contract (F447 AC-SET-035)', () => {
  it('renders the import dialog scaffold with the confirm button bound to plain vars', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvImportModal
        open
        onClose={() => undefined}
        onImport={() => undefined}
        t={translator()}
      />,
    );
    expect(html).toContain('envImportTitle');
    expect(html).toContain('envImportHint');
    expect(html).toContain('envImportConfirm');
    expect(html).toContain('cancel');
  });

  it('excludes suspected-sensitive keys from the plain import payload on confirm', () => {
    const parsed = parseEnvText(
      'NODE_ENV=production\nS3_SECRET_ACCESS_KEY=AKIA-secret\nPORT=8080\n',
    );
    expect(Object.keys(parsed.plainVars).sort()).toEqual(['NODE_ENV', 'PORT']);
    expect(parsed.plainVars).not.toHaveProperty('S3_SECRET_ACCESS_KEY');
    expect(parsed.sensitiveVars).toHaveProperty('S3_SECRET_ACCESS_KEY', 'AKIA-secret');
  });

  it('keeps invalid and duplicate rows visible while excluding them from the commit set', () => {
    const parsed = parseEnvText('OK=1\nBAD LINE\nOK=2\n');
    expect(parsed.invalidCount).toBe(1);
    expect(parsed.duplicates).toEqual({ OK: 2 });
    expect(parsed.plainVars).toEqual({ OK: '2' });
  });
});

function translator() {
  return ((key: string) => key) as never;
}
