import '@testing-library/jest-dom/vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentPicker } from '../src/components/chat/AgentPicker';
import { ContentEditor } from '../src/components/chat/ContentEditor';
import { CsvFanoutBlock } from '../src/components/chat/CsvFanoutBlock';
import { ImageResultBlock } from '../src/components/chat/ImageResultBlock';
import { PlanPanel } from '../src/components/chat/PlanPanel';
import { ResearchReport } from '../src/components/chat/ResearchReport';
import { CommandBlockView } from '../src/components/chat/blocks/CommandBlockView';
import { PlanBlockView } from '../src/components/chat/blocks/PlanBlockView';
import { ProgressBlockView } from '../src/components/chat/blocks/ProgressBlockView';
import { SubagentBlockView } from '../src/components/chat/blocks/SubagentBlockView';
import { WarningBlockView } from '../src/components/chat/blocks/WarningBlockView';
import { WebSearchBlockView } from '../src/components/chat/blocks/WebSearchBlockView';

const ROOT = `${process.cwd()}/src/components/`;
const PRIMARY = [
  'chat/ActivityIndicator.tsx',
  'chat/AgentPicker.tsx',
  'chat/AssistantContentBlock.tsx',
  'chat/AssistantMessageActions.tsx',
  'chat/AssistantMessageView.tsx',
  'chat/AssistantProcessToggle.tsx',
  'chat/AssistantTextBlock.tsx',
  'chat/AutoReviewBlockView.tsx',
  'chat/ChatMessage.tsx',
  'chat/ChatPanel.tsx',
  'chat/ChatPanelConversation.tsx',
  'chat/ChatStatusAnnouncer.tsx',
  'chat/CodeBlock.tsx',
  'chat/ContentEditor.tsx',
  'chat/CsvFanoutBlock.tsx',
  'chat/ImageResultBlock.tsx',
  'chat/LegacyAssistantContent.tsx',
  'chat/LegacyToolCallGroup.tsx',
  'chat/PlanPanel.tsx',
  'chat/PlanStepStatusIcon.tsx',
  'chat/ResearchReport.tsx',
  'chat/SystemMessageView.tsx',
  'chat/ThinkingDisclosure.tsx',
  'chat/ToolCallCard.tsx',
  'chat/ToolCallDetails.tsx',
  'chat/ToolCallHeader.tsx',
  'chat/UserMessageView.tsx',
];
const TSX_DIRS = ['chat/blocks', 'timeline'];
const TIMELINE_ARTICLES = [
  'timeline/ApprovalDecisionItemView.tsx',
  'timeline/CommandExecutionItemView.tsx',
  'timeline/FileOutcomeItemView.tsx',
  'timeline/OutcomeItemView.tsx',
  'timeline/ToolExecutionItemView.tsx',
];
const FORBIDDEN_STATE_SYMBOL = /[\u2713\u2717\u25cf\u00d7\u26a0\u2193\u25cb\u25c7\u25be\u25b8\u25b4]|[\u{1F300}-\u{1FAFF}]/u;

function ownedSources(): string[] {
  const directoryFiles = TSX_DIRS.flatMap((directory) => readdirSync(`${ROOT}${directory}`)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => `${directory}/${name}`));
  return [...PRIMARY, ...directoryFiles].map((path) => readFileSync(`${ROOT}${path}`, 'utf8'));
}

describe('owned transcript icon guard', () => {
  it('contains no inline SVG, emoji, or text-symbol state stand-ins in source', () => {
    for (const source of ownedSources()) {
      expect(source).not.toMatch(/<svg\b/);
      expect(source).not.toMatch(FORBIDDEN_STATE_SYMBOL);
      expect(source).not.toMatch(/from\s+['"]lucide-react['"]/);
    }
  });

  it('keeps every nested timeline article explicitly outside live announcements', () => {
    for (const path of TIMELINE_ARTICLES) {
      expect(readFileSync(`${ROOT}${path}`, 'utf8')).toContain('aria-live="off"');
    }
  });

  it('renders state assets as decorative shared Lucide icons without text glyphs', () => {
    const plan = { planId: 'plan', title: 'Plan', steps: [
      { id: '1', title: 'Done', status: 'completed' },
      { id: '2', title: 'Working', status: 'in_progress' },
      { id: '3', title: 'Failed', status: 'failed' },
    ] };
    const { container } = render(<>
      <PlanPanel plan={plan} />
      <PlanBlockView plan={plan} />
      <CsvFanoutBlock totalRows={1} rows={[{ rowIndex: 1, status: 'running', rowData: { id: '1' } }]} />
      <ProgressBlockView text="Working" status="running" />
      <SubagentBlockView agentId="agent" task="Review" status="completed" summary="Done" />
      <WarningBlockView text="Warning detail" />
      <WebSearchBlockView query="query" results={[]} />
      <ImageResultBlock model="fixture" images={[{ base64: 'data:image/png;base64,AA==' }]} />
      <AgentPicker agents={[]} current={null} onSelect={vi.fn()} />
      <ResearchReport title="Report" content="# Heading" phase="searching" />
      <ContentEditor content="Text" onClose={vi.fn()} />
      <CommandBlockView label="Run" action="run" />
    </>);

    expect(container.textContent).not.toMatch(FORBIDDEN_STATE_SYMBOL);
    const icons = [...container.querySelectorAll('svg')];
    expect(icons.length).toBeGreaterThan(10);
    for (const icon of icons) {
      expect(icon.classList.contains('lucide')).toBe(true);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
