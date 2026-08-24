import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../../../../../..');

describe('core release Modal accessibility contract', () => {
  it('keeps one labelled, described, focus-trapped shared Modal with a 44px close target', () => {
    const modal = source('packages/ui/src/components/Modal/index.tsx');
    expect(modal).toContain('aria-labelledby={title ? titleId : undefined}');
    expect(modal).toContain(
      'aria-describedby={ariaDescriptionId ?? (description ? descriptionId : undefined)}',
    );
    const focus = source('packages/ui/src/hooks/useDialogFocus.ts');
    expect(focus).toMatch(/if \(event\.key !== ["']Tab["'] \|\| !trapFocus\) return/);
    expect(focus).toContain('focusableWithin(container)');
    expect(focus).toContain('Boolean((element as HTMLButtonElement).disabled)');
    const layer = source('packages/ui/src/hooks/useModalLayer.ts');
    expect(layer).toContain('layers[layers.length - 1]');
    expect(layer).toContain('bodyOverflow');
    expect(layer).toMatch(
      /document\.addEventListener\(["']keydown["'], onDocumentKeyDown, true\)/,
    );
    expect(modal).toContain('inline-flex size-11');
  });

  it.each([
    'release-order-create-modal.tsx',
    'release-gate-catalog-dialog.tsx',
  ])('connects %s to the shared description and 44px action contract', (file) => {
    const content = source(
      `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/${file}`,
    );
    expect(content).toContain("from '@/components/ui'");
    expect(content).toContain('ariaDescriptionId=');
    expect(content).toContain('min-h-11');
  });
});

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}
