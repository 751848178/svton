import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const safeFiles = [
  'packages/ui/src/components/Modal/index.tsx',
  'packages/ui/src/components/Drawer/index.tsx',
  'apps/agent-desktop/src/components/icons.tsx',
  'packages/agent-ui/src/components/layout/sidebar-icons.tsx',
  'packages/agent-ui/src/components/chat/blocks/BlockIcon.tsx',
  'packages/agent-ui/src/components/chat/ActivityIndicator.tsx',
  'packages/agent-ui/src/components/chat/ChatPanelConversation.tsx',
];

describe('I08.1 source ownership', () => {
  it('contains no handmade SVG or asset glyph in the safe foundation files', () => {
    for (const path of safeFiles) {
      const source = readFileSync(resolve(root, path), 'utf8');
      expect(source, path).not.toMatch(/<svg\b/);
      expect(source, path).not.toMatch(/[×↓✦●✓✗○📋📄🤖⚠]/u);
    }
  });

  it('declares lucide only at the shared design-system owner', () => {
    const manifests = [
      'packages/ui/package.json',
      'packages/agent-ui/package.json',
      'apps/agent-web/package.json',
      'apps/agent-desktop/package.json',
    ];
    const owners = manifests.filter((path) => readFileSync(resolve(root, path), 'utf8').includes('lucide-react'));
    expect(owners).toEqual(['packages/ui/package.json']);
  });
});
