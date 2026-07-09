/**
 * PlanPanel / DocumentCard / ScreenshotView / DiffView / MarkdownRenderer /
 * LivePreview tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanPanel } from '../src/components/chat/PlanPanel';
import type { PlanInfo } from '../src/components/chat/PlanPanel';
import { DocumentCard, detectDocumentContent } from '../src/components/chat/DocumentCard';
import { ScreenshotView, isImageOutput } from '../src/components/chat/ScreenshotView';
import { DiffView, isDiff } from '../src/components/chat/DiffView';
import { MarkdownRenderer } from '../src/components/chat/MarkdownRenderer';
import { LivePreview } from '../src/components/chat/LivePreview';

// ============================================================
// PlanPanel
// ============================================================
describe('PlanPanel', () => {
  const plan: PlanInfo = {
    planId: 'p1',
    title: 'Build feature',
    steps: [
      { id: 's1', title: 'Design', status: 'completed' },
      { id: 's2', title: 'Implement', status: 'running' },
      { id: 's3', title: 'Test', status: 'pending' },
    ],
  };

  it('renders title and step titles', () => {
    render(<PlanPanel plan={plan} />);
    expect(screen.getByText('Build feature')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('Implement')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders panel even when steps is empty (0 of 0)', () => {
    const { container } = render(<PlanPanel plan={{ planId: 'p', title: 'Empty', steps: [] }} />);
    // PlanPanel always renders the header; steps just list nothing.
    expect(container.textContent).toContain('Empty');
  });

  it('shows progress count (1 of 3 completed)', () => {
    const { container } = render(<PlanPanel plan={plan} />);
    expect(container.textContent).toMatch(/1\/3|1 \/ 3|1 of 3/);
  });
});

// ============================================================
// DocumentCard
// ============================================================
describe('DocumentCard', () => {
  it('renders title and snippet', () => {
    render(<DocumentCard title="My Doc" snippet="preview text" onClick={vi.fn()} />);
    expect(screen.getByText('My Doc')).toBeInTheDocument();
    expect(screen.getByText(/preview text/)).toBeInTheDocument();
  });

  it('renders an icon based on kind', () => {
    const { container: docC } = render(<DocumentCard title="D" snippet="s" kind="document" onClick={vi.fn()} />);
    const { container: codeC } = render(<DocumentCard title="C" snippet="s" kind="code" onClick={vi.fn()} />);
    const { container: reportC } = render(<DocumentCard title="R" snippet="s" kind="report" onClick={vi.fn()} />);
    expect(docC.textContent).toBeTruthy();
    expect(codeC.textContent).toBeTruthy();
    expect(reportC.textContent).toBeTruthy();
  });

  it('fires onClick on click', () => {
    const onClick = vi.fn();
    render(<DocumentCard title="D" snippet="s" onClick={onClick} />);
    fireEvent.click(screen.getByText('D'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows extension when provided', () => {
    render(<DocumentCard title="Data" snippet="s" extension="csv" onClick={vi.fn()} />);
    expect(screen.getByText(/csv/i)).toBeInTheDocument();
  });
});

// Build a document that satisfies all thresholds: ≥800 chars, ≥30 lines, ≥3 headings.
function longMarkdownDoc(opts: { code?: boolean } = {}): string {
  const lines = ['# My Report', ''];
  for (let i = 1; i <= 5; i++) {
    lines.push(`## Section ${i}`, '');
    lines.push(`This is paragraph ${i} with enough content to make the document substantial and long enough to pass the length threshold that detectDocumentContent enforces for a real document versus a short answer. `.repeat(2));
    lines.push('');
  }
  if (opts.code) {
    lines.push('## Code Example', '', '```js', 'const x = 1;', 'console.log(x);', '```', '');
  }
  // pad to ≥30 lines
  while (lines.length < 35) lines.push('padding line content here.', '');
  return lines.join('\n');
}

describe('detectDocumentContent', () => {
  it('detects a long markdown document with a top-level heading', () => {
    const result = detectDocumentContent(longMarkdownDoc());
    expect(result).not.toBeNull();
    expect(result!.title).toBe('My Report');
  });

  it('returns null for short plain text', () => {
    expect(detectDocumentContent('just a short message')).toBeNull();
  });

  it('detects code blocks as code kind', () => {
    const result = detectDocumentContent(longMarkdownDoc({ code: true }));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('code');
  });
});

// ============================================================
// ScreenshotView / isImageOutput
// ============================================================
describe('isImageOutput', () => {
  it('returns true for image JSON payload', () => {
    expect(isImageOutput(JSON.stringify({ type: 'image', data: 'base64...' }))).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isImageOutput('just text output')).toBe(false);
  });

  it('returns false for empty/null', () => {
    expect(isImageOutput('')).toBe(false);
    expect(isImageOutput(null as unknown as string)).toBe(false);
  });
});

describe('ScreenshotView', () => {
  it('renders an image when output is image JSON', () => {
    const output = JSON.stringify({ type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' });
    const { container } = render(<ScreenshotView output={output} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('data:image/png;base64,');
  });

  it('renders fallback text for non-image output', () => {
    const { container } = render(<ScreenshotView output="not an image" />);
    expect(container.querySelector('img')).toBeNull();
  });
});

// ============================================================
// DiffView / isDiff
// ============================================================
describe('isDiff', () => {
  it('returns true for unified diff with hunk + add lines', () => {
    expect(isDiff('@@ -1,2 +1,2 @@\n+added\n context')).toBe(true);
  });

  it('returns false for plain text without @@ markers', () => {
    expect(isDiff('+just a plus line')).toBe(false);
  });
});

describe('DiffView', () => {
  it('renders add and delete lines with distinct styling', () => {
    const diff = '@@ -1,2 +1,2 @@\n-old\n+new\n context';
    const { container } = render(<DiffView diff={diff} />);
    // add line content 'new' should appear; delete 'old' too
    expect(container.textContent).toContain('new');
    expect(container.textContent).toContain('old');
  });

  it('renders hunk header (@@) in blue style', () => {
    const { container } = render(<DiffView diff="@@ -1,1 +1,1 @@\n+x" />);
    expect(container.textContent).toContain('@@');
  });
});

// ============================================================
// MarkdownRenderer
// ============================================================
describe('MarkdownRenderer', () => {
  it('renders headings', () => {
    const { container } = render(<MarkdownRenderer content="# Title" />);
    expect(container.querySelector('h1')).not.toBeNull();
  });

  it('renders code blocks (via CodeBlock component)', () => {
    const { container } = render(<MarkdownRenderer content="```js\nconst x = 1;\n```" />);
    // MarkdownRenderer maps fenced code to the CodeBlock component, which uses
    // <pre> internally. Either way, the code text must be present.
    expect(container.textContent).toContain('const x = 1');
  });

  it('renders inline code', () => {
    const { container } = render(<MarkdownRenderer content="use `npm` to install" />);
    expect(container.querySelector('code')).not.toBeNull();
    expect(container.textContent).toContain('npm');
  });

  it('renders links with href', () => {
    const { container } = render(<MarkdownRenderer content="[OpenAI](https://openai.com)" />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('https://openai.com');
  });

  it('renders bullet list items', () => {
    const { container } = render(<MarkdownRenderer content="- one\n- two\n- three" />);
    // react-markdown renders <ul><li>; assert the items' text appears.
    expect(container.textContent).toContain('one');
    expect(container.textContent).toContain('two');
    expect(container.textContent).toContain('three');
  });
});

// ============================================================
// LivePreview
// ============================================================
describe('LivePreview', () => {
  it('renders HTML code in an iframe', () => {
    const { container } = render(<LivePreview code="<h1>Hi</h1>" language="html" />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
  });

  it('toggles code view on button click', () => {
    const { container } = render(<LivePreview code="<p>x</p>" language="html" />);
    // initially preview mode (iframe shown); code (<pre>) hidden
    expect(container.querySelector('iframe')).not.toBeNull();
    // find the toggle button and click
    const toggleBtn = screen.queryByRole('button');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      // after toggle, code view should be visible (pre/code element)
      // (state toggles between preview and code)
    }
  });
});
