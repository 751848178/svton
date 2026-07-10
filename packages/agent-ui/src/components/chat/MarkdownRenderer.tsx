import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@svton/ui';
import { CodeBlock } from './CodeBlock';
// Re-exported from the shared module so CodeBlock and MarkdownRenderer use the
// same ESM hljs instance with all languages registered.
import { hljs } from '../../lib/highlight-setup';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Extract plain text from React children (handles nested elements).
 */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) {
    return extractText((children.props as { children?: React.ReactNode })?.children);
  }
  return '';
}

/**
 * Renders Markdown content with Codex-style formatting.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  return (
    <div className={cn('min-w-0 overflow-hidden break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Shared markdown component overrides
// ─────────────────────────────────────────────────────

const markdownComponents: Components = {
  // Code blocks & inline code
  code({ className: codeClassName, children, ...rest }) {
    const lang = /language-(\w+)/.exec(codeClassName || '')?.[1];
    const text = extractText(children).replace(/\n$/, '');

    // Check if inside <pre> (block code) by inspecting the parent node
    const node = (rest as { node?: { tagName?: string; properties?: { className?: string[] } } })?.node;
    const isInsidePre = node?.properties?.className?.[0]?.startsWith('language-') || lang;

    if (isInsidePre || lang) {
      return <CodeBlock code={text} language={lang} highlight />;
    }

    // Inline code
    if (!text.includes('\n') && text.length < 200) {
      return (
        <code className="bg-[#2a2a2a] text-gray-300 px-1.5 py-0.5 rounded text-[13px] font-mono">
          {text}
        </code>
      );
    }

    return <CodeBlock code={text} />;
  },

  // Pre tag: delegate to code component
  pre({ children }) {
    return <>{children}</>;
  },

  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },

  h1({ children }) {
    return <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>;
  },

  ul({ children }) {
    return <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm leading-relaxed">{children}</li>;
  },

  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-cyan-500 hover:text-cyan-400 underline">
        {children}
      </a>
    );
  },

  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[#3a3a3a] pl-3 my-2 text-gray-500 italic">
        {children}
      </blockquote>
    );
  },

  hr() {
    return <hr className="border-t border-[#383838] my-3" />;
  },

  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border border-[#383838] rounded text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[#2a2a2a]">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-400 border-b border-[#383838]">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-3 py-1.5 border-b border-[#333] text-gray-300">{children}</td>
    );
  },

  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em>{children}</em>;
  },
};
