import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeReviewBlock, type ReviewFinding } from '../src/components/chat/CodeReviewBlock';
import { ImageResultBlock, type GeneratedImage } from '../src/components/chat/ImageResultBlock';
import { CsvFanoutBlock } from '../src/components/chat/CsvFanoutBlock';
import { ReasoningEffortSelector } from '../src/components/chat/ReasoningEffortSelector';
import { AgentPicker, type AgentDefinitionOption } from '../src/components/chat/AgentPicker';
import { ChatMessage, type ContentBlock } from '../src/components/chat/ChatMessage';

// ==============================================================
// Sample data
// ==============================================================

const sampleFindings: ReviewFinding[] = [
  { file: 'src/app.ts', line: 42, severity: 'error', comment: 'Potential SQL injection' },
  { file: 'src/utils.ts', line: 10, severity: 'warning', comment: 'Unused variable' },
];

const sampleImages: GeneratedImage[] = [
  { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', revisedPrompt: 'A cat' },
];

const sampleAgents: AgentDefinitionOption[] = [
  { name: 'coder', title: 'Coder', description: 'Writes code', icon: '{ }', color: '#00ff00' },
  { name: 'reviewer', title: 'Reviewer', description: 'Reviews PRs', icon: '🔍', color: '#00ccff' },
];

const sampleCsvRows = [
  { rowIndex: 1, status: 'success' as const, rowData: { name: 'Alice', email: 'alice@example.com' }, summary: 'OK' },
  { rowIndex: 2, status: 'failed' as const, rowData: { name: 'Bob', email: 'bob@example.com' }, summary: 'Error' },
  { rowIndex: 3, status: 'success' as const, rowData: { name: 'Carol', email: 'carol@example.com' }, summary: 'OK' },
];

// ==============================================================
// Tests
// ==============================================================

describe('New components — Gap 12+13 fixes', () => {
  // ----------------------------------------------------------
  // 1. CodeReviewBlock
  // ----------------------------------------------------------
  describe('CodeReviewBlock', () => {
    it('renders findings with file names and severities', () => {
      render(<CodeReviewBlock findings={sampleFindings} />);

      // Header
      expect(screen.getByText('Code Review')).toBeInTheDocument();
      expect(screen.getByText(/2 findings/)).toBeInTheDocument();

      // Each finding's location should appear
      expect(screen.getByText('src/app.ts:42')).toBeInTheDocument();
      expect(screen.getByText('src/utils.ts:10')).toBeInTheDocument();

      // Each severity label (uppercase) appears
      expect(screen.getByText('error')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
    });

    it('renders finding comments', () => {
      render(<CodeReviewBlock findings={sampleFindings} />);

      expect(screen.getByText('Potential SQL injection')).toBeInTheDocument();
      expect(screen.getByText('Unused variable')).toBeInTheDocument();
    });

    it('shows error count badge', () => {
      render(<CodeReviewBlock findings={sampleFindings} />);

      expect(screen.getByText(/1 error/)).toBeInTheDocument();
      expect(screen.getByText(/1 warning/)).toBeInTheDocument();
    });

    it('renders nothing for empty findings', () => {
      const { container } = render(<CodeReviewBlock findings={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('calls onFileClick when a finding location is clicked', () => {
      const onFileClick = vi.fn();
      render(<CodeReviewBlock findings={sampleFindings} onFileClick={onFileClick} />);

      fireEvent.click(screen.getByText('src/app.ts:42'));
      expect(onFileClick).toHaveBeenCalledWith('src/app.ts', 42);
    });

    it('collapses findings when header clicked', () => {
      render(<CodeReviewBlock findings={sampleFindings} />);

      // Initially expanded — comment visible
      expect(screen.getByText('Potential SQL injection')).toBeInTheDocument();

      // Click header to collapse
      fireEvent.click(screen.getByText('Code Review'));

      // Comment should be hidden now
      expect(screen.queryByText('Potential SQL injection')).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 2. ImageResultBlock
  // ----------------------------------------------------------
  describe('ImageResultBlock', () => {
    it('renders an img element for base64 images', () => {
      render(<ImageResultBlock images={sampleImages} model="dall-e-3" />);

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'));
      expect(img).toHaveAttribute('alt', 'A cat');
    });

    it('shows the model name in header', () => {
      render(<ImageResultBlock images={sampleImages} model="dall-e-3" />);

      expect(screen.getByText('dall-e-3')).toBeInTheDocument();
    });

    it('shows image count in header', () => {
      render(<ImageResultBlock images={sampleImages} model="m" />);

      expect(screen.getByText(/1 Image Generated/)).toBeInTheDocument();
    });

    it('renders nothing for empty images', () => {
      const { container } = render(<ImageResultBlock images={[]} model="m" />);
      expect(container.firstChild).toBeNull();
    });

    it('supports URL-based images', () => {
      render(<ImageResultBlock images={[{ url: 'https://example.com/cat.png' }]} model="m" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/cat.png');
    });
  });

  // ----------------------------------------------------------
  // 3. CsvFanoutBlock
  // ----------------------------------------------------------
  describe('CsvFanoutBlock', () => {
    it('renders total rows count in header', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      // Header shows completed/total — "2/3" since 2 are success/failed
      // Wait, all 3 are success or failed, so it should be 3/3
      expect(screen.getByText('CSV Fan-out')).toBeInTheDocument();
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });

    it('shows row data in the table', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });

    it('shows percentage progress', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      // 3 completed out of 3 total = 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('shows failed badge when there are failures', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    });

    it('shows column headers from row data', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('can be collapsed', () => {
      render(<CsvFanoutBlock rows={sampleCsvRows} totalRows={3} />);

      // Row data visible initially
      expect(screen.getByText('Alice')).toBeInTheDocument();

      // Click header to collapse
      fireEvent.click(screen.getByText('CSV Fan-out'));

      // Row data hidden
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 4. ReasoningEffortSelector
  // ----------------------------------------------------------
  describe('ReasoningEffortSelector', () => {
    it('renders with default Auto value', () => {
      render(<ReasoningEffortSelector value={undefined} onChange={vi.fn()} />);

      // Default option is "Auto"
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('shows all options when opened', () => {
      render(<ReasoningEffortSelector value={undefined} onChange={vi.fn()} />);

      // Click trigger to open menu
      fireEvent.click(screen.getByText('Auto'));

      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Xhigh')).toBeInTheDocument();
    });

    it('calls onChange with selected value', () => {
      const onChange = vi.fn();
      render(<ReasoningEffortSelector value={undefined} onChange={onChange} />);

      fireEvent.click(screen.getByText('Auto'));
      fireEvent.click(screen.getByText('High'));

      expect(onChange).toHaveBeenCalledWith('high');
    });

    it('shows current selection highlight', () => {
      render(<ReasoningEffortSelector value="medium" onChange={vi.fn()} />);

      // Trigger shows Medium
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 5. AgentPicker
  // ----------------------------------------------------------
  describe('AgentPicker', () => {
    it('renders default trigger text when no agent selected', () => {
      render(<AgentPicker agents={sampleAgents} current={null} onSelect={vi.fn()} />);

      expect(screen.getByText('Select Agent')).toBeInTheDocument();
    });

    it('shows agent names when opened', () => {
      render(<AgentPicker agents={sampleAgents} current={null} onSelect={vi.fn()} />);

      // Click trigger to open
      fireEvent.click(screen.getByText('Select Agent'));

      // Agent titles should appear
      expect(screen.getByText('Coder')).toBeInTheDocument();
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
    });

    it('shows agent descriptions', () => {
      render(<AgentPicker agents={sampleAgents} current={null} onSelect={vi.fn()} />);

      fireEvent.click(screen.getByText('Select Agent'));

      expect(screen.getByText('Writes code')).toBeInTheDocument();
      expect(screen.getByText('Reviews PRs')).toBeInTheDocument();
    });

    it('shows current agent title when one is selected', () => {
      render(<AgentPicker agents={sampleAgents} current="coder" onSelect={vi.fn()} />);

      expect(screen.getByText('Coder')).toBeInTheDocument();
    });

    it('calls onSelect with agent name', () => {
      const onSelect = vi.fn();
      render(<AgentPicker agents={sampleAgents} current={null} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Select Agent'));
      fireEvent.click(screen.getByText('Coder'));

      expect(onSelect).toHaveBeenCalledWith('coder');
    });

    it('shows Default Agent option', () => {
      render(<AgentPicker agents={sampleAgents} current="coder" onSelect={vi.fn()} />);

      fireEvent.click(screen.getByText('Coder'));

      expect(screen.getByText('Default Agent')).toBeInTheDocument();
    });

    it('calls onSelect with empty string for Default Agent', () => {
      const onSelect = vi.fn();
      render(<AgentPicker agents={sampleAgents} current="coder" onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Coder'));
      fireEvent.click(screen.getByText('Default Agent'));

      expect(onSelect).toHaveBeenCalledWith('');
    });
  });

  // ----------------------------------------------------------
  // Helper: expand collapsed process blocks in ChatMessage.
  // When isStreaming is false and blocks contain only process
  // blocks (non-text), ChatMessage collapses them behind a
  // "已处理" toggle. This clicks the toggle to reveal them.
  // ----------------------------------------------------------
  function expandProcessBlocks() {
    const toggle = screen.queryByText('已处理');
    if (toggle) {
      fireEvent.click(toggle);
    }
  }

  // ----------------------------------------------------------
  // 6. ChatMessage with image_generated block
  // ----------------------------------------------------------
  describe('ChatMessage renders image_generated block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'image_generated',
        images: [{ base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', revisedPrompt: 'A sunset' }],
        model: 'dall-e-3',
      },
    ];

    it('renders the ImageResultBlock content within ChatMessage', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      // Process blocks are collapsed — expand first
      expandProcessBlocks();

      // Image should be present
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'A sunset');
    });

    it('shows the model name in ChatMessage', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      expect(screen.getByText('dall-e-3')).toBeInTheDocument();
    });

    it('shows image count header', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      expect(screen.getByText(/1 Image Generated/)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 7. ChatMessage renders code_review block
  // ----------------------------------------------------------
  describe('ChatMessage renders code_review block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'code_review',
        findings: [
          { file: 'src/app.ts', line: 42, severity: 'error', comment: 'Potential SQL injection' },
          { file: 'src/utils.ts', line: 10, severity: 'warning', comment: 'Unused variable' },
        ],
      },
    ];

    it('renders findings within ChatMessage', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      // Code Review header
      expect(screen.getByText('Code Review')).toBeInTheDocument();
    });

    it('shows finding locations', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      expect(screen.getByText('src/app.ts:42')).toBeInTheDocument();
      expect(screen.getByText('src/utils.ts:10')).toBeInTheDocument();
    });

    it('shows finding comments', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      expect(screen.getByText('Potential SQL injection')).toBeInTheDocument();
      expect(screen.getByText('Unused variable')).toBeInTheDocument();
    });

    it('passes onOpenReference as onFileClick for code review findings', () => {
      const onOpenReference = vi.fn();
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
          onOpenReference={onOpenReference}
        />,
      );

      expandProcessBlocks();

      // Click a finding location
      fireEvent.click(screen.getByText('src/app.ts:42'));
      expect(onOpenReference).toHaveBeenCalledWith('src/app.ts', 42);
    });
  });

  // ----------------------------------------------------------
  // 8. ChatMessage renders csv_fanout block
  // ----------------------------------------------------------
  describe('ChatMessage renders csv_fanout block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'csv_fanout',
        totalRows: 2,
        succeeded: 1,
        failed: 1,
        rows: [
          { rowIndex: 1, status: 'success', rowData: { task: 'Task A' }, summary: 'done' },
          { rowIndex: 2, status: 'failed', rowData: { task: 'Task B' }, summary: 'error' },
        ],
      },
    ];

    it('renders CSV Fan-out header within ChatMessage', () => {
      render(
        <ChatMessage
          id="m1"
          role="assistant"
          content=""
          blocks={blocks}
        />,
      );

      expandProcessBlocks();

      expect(screen.getByText('CSV Fan-out')).toBeInTheDocument();
    });
  });
});
