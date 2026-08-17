import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../../../../../..');

describe('core release Modal accessibility contract', () => {
  it('keeps one labelled, described, focus-trapped shared Modal with a 44px close target', () => {
    const modal = source('packages/ui/src/components/Modal/index.tsx');
    expect(modal).toContain('aria-labelledby={title ? titleId : undefined}');
    expect(modal).toContain('aria-describedby={ariaDescriptionId}');
    expect(modal).toContain("document.addEventListener('keydown', handleTab, true)");
    expect(modal).toContain("document.addEventListener('focusin', containFocus, true)");
    expect(modal).toContain('tabbableElements(panelRef.current)');
    expect(modal).toContain("element.hasAttribute('disabled')");
    expect(modal).toContain("data-overlay-topmost={overlay.topmost ? 'true' : 'false'}");
    const overlay = source('packages/ui/src/hooks/useOverlay.ts');
    expect(overlay).toContain('stack[stack.length - 1] === id.current');
    expect(overlay).toContain('bodyLockCount');
    expect(modal).toContain('min-h-11 min-w-11');
  });

  it.each([
    'release-order-create-modal.tsx',
    'release-gate-catalog-dialog.tsx',
    'release-production-confirm-dialog.tsx',
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
