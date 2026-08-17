import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '../..');
const fixedOwners = [
  'apps/agent-web/src/app/settings/page.tsx',
  ...['AgentChat', 'AgentLayout', 'ChatContent', 'ChatInputControls.component',
    'ErrorBoundary', 'Sidebar', 'WebAgentContent', 'WebAgentsPanel',
    'WebAutomationPanel', 'WebIntegrationsPanel', 'WebSessionSidebar', 'WebSkillsPanel']
    .map((name) => `apps/agent-web/src/components/${name}.tsx`),
  ...['ComposerActions', 'ComposerAttachMenu', 'ComposerAttachments', 'ComposerPopups',
    'ComposerStatus', 'ComposerSurface', 'PublicComposerAttachments',
    'ReasoningEffortSelector', 'SessionSettingsControls', 'ToolApprovalModal',
    'UserInputForm', 'UserInputQuestionField']
    .map((name) => `packages/agent-ui/src/components/chat/${name}.tsx`),
  'packages/agent-ui/src/components/feedback/StartupStateView.tsx',
  ...['SessionActivityIndicator', 'SessionDeleteDialog', 'SessionManagementMenu',
    'SessionRenameDialog', 'SessionSearchControls', 'Sidebar', 'SidebarNavigationSection',
    'SidebarSessionList', 'session-activity-copy', 'session-management-copy',
    'use-session-management-menu']
    .map((name) => `packages/agent-ui/src/components/layout/${name}.${name.startsWith('use-') || name.endsWith('-copy') ? 'ts' : 'tsx'}`),
  'packages/agent-ui/src/components/models/ModelSelector.tsx',
  ...['ApprovalDecisionItemView', 'CommandExecutionItemView', 'FileOutcomeItemView',
    'OutcomeItemView', 'ProcessDisclosure', 'ToolExecutionItemView']
    .map((name) => `packages/agent-ui/src/components/timeline/${name}.tsx`),
  ...['timeline-execution-copy', 'timeline-file-copy', 'timeline-status-copy']
    .map((name) => `packages/agent-ui/src/components/timeline/${name}.ts`),
  'packages/agent-app/src/models/use-model-switch.ts',
  'packages/agent-app/src/models/use-session-settings-control.ts',
  'packages/agent-app/src/chat/use-chat-interaction-controller.ts',
  'packages/agent-app/src/chat/composer-submission.ts',
  'packages/agent-app/src/artifacts/use-artifact-controller.ts',
  ...['use-composer-controller', 'read-composer-images']
    .map((name) => `packages/agent-ui/src/components/chat/${name}.ts`),
  'packages/agent-ui/src/components/chat/ChatPanelConversation.tsx',
  ...['ArtifactPanel', 'ArtifactDirtyDialog', 'ArtifactReadonlyView',
    'ArtifactEditableView', 'ArtifactHostStatus']
    .map((name) => `packages/agent-ui/src/components/artifacts/${name}.tsx`),
  ...['FileChangeView', 'TurnDiffView', 'FileTreeBlockView']
    .map((name) => `packages/agent-ui/src/components/chat/blocks/${name}.tsx`),
  'packages/agent-ui/src/components/chat/DocumentCard.tsx',
  'packages/agent-ui/src/components/chat/CodeReviewBlock.tsx',
  'packages/ui/src/i18n/catalogs/timeline.en.ts',
  'packages/ui/src/i18n/catalogs/timeline.zh.ts',
  'packages/ui/src/i18n/catalogs/index.ts',
  'ai/agent-client/src/timeline/public-event-selector.ts',
  'packages/agent-app/src/components/timeline-host-intents.ts',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

const ownedFiles = [...new Set([
  ...fixedOwners,
  ...sourceFiles('packages/agent-ui/src/components/settings'),
])];
const forbiddenAssetGlyph = /[×✓✗●]|[\u{1F300}-\u{1FAFF}]/u;

describe('I08.3c-3 owned source contract', () => {
  it('keeps every maintained owner at 200 lines or fewer without local asset substitutes', () => {
    for (const file of ownedFiles) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source.split('\n').length, file).toBeLessThanOrEqual(200);
      expect(source, file).not.toMatch(/<svg\b|from\s+['"]lucide-react['"]/);
      expect(source, file).not.toMatch(forbiddenAssetGlyph);
    }
  });

  it('has no parameterless locale formatting or unowned Chinese presentation copy', () => {
    const payloadOwners = new Set([
      'apps/agent-web/src/components/AgentLayout.tsx',
      'apps/agent-web/src/components/ChatContent.tsx',
    ]);
    for (const file of ownedFiles) {
      const rawSource = readFileSync(resolve(root, file), 'utf8');
      const source = file === 'packages/agent-ui/src/components/chat/ChatPanelConversation.tsx'
        ? rawSource.replace("message: '当前主机不支持此消息操作。',", '')
        : rawSource;
      expect(source, file).not.toMatch(/\.toLocaleString\(\)/);
      if (!payloadOwners.has(file) && !file.endsWith('timeline.zh.ts')) {
        expect(source, file).not.toMatch(/[一-龥]/u);
      }
    }
  });

  it('retains the required responsibility splits and removes their aggregates', () => {
    const removed = [
      'apps/agent-web/src/components/WebAuxiliaryPanels.tsx',
      'packages/agent-ui/src/components/settings/sections/MemorySearchSections.tsx',
      'packages/agent-ui/src/components/settings/sections/AutomationPreviewSections.tsx',
    ];
    expect(removed.filter((file) => existsSync(resolve(root, file)))).toEqual([]);
    const webContent = readFileSync(resolve(root, 'apps/agent-web/src/components/WebAgentContent.tsx'), 'utf8');
    for (const panel of ['WebAutomationPanel', 'WebSkillsPanel', 'WebAgentsPanel', 'WebIntegrationsPanel']) {
      expect(webContent).toContain(panel);
    }
  });

  it('derives timeline chrome from typed semantics without changing suppression', () => {
    for (const name of ['CommandExecutionItemView', 'FileOutcomeItemView',
      'ToolExecutionItemView', 'ApprovalDecisionItemView']) {
      const source = readFileSync(resolve(root,
        `packages/agent-ui/src/components/timeline/${name}.tsx`), 'utf8');
      expect(source, name).not.toMatch(/\{item\.(title|summary)\}/);
    }
    const policy = readFileSync(resolve(root,
      'packages/agent-ui/src/components/timeline/legacy-render-policy.ts'), 'utf8');
    expect(policy).toContain("block.type === 'file_change' || block.type === 'turn_diff'");
    expect(policy).toContain("block.type === 'tool_call' && block.call && toolIds.has(block.call.id)");
    const host = readFileSync(resolve(root,
      'packages/agent-app/src/components/timeline-host-intents.ts'), 'utf8');
    expect(host).toContain("return { status: 'unavailable' }");
    expect(host).not.toContain('unavailable in this host');
  });
});
