import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@svton/ui';
import { CodeBlock } from './CodeBlock';
// Re-exported from the shared module so CodeBlock and MarkdownRenderer use the
// same ESM hljs instance with all languages registered.
import { hljs } from '../../lib/highlight-setup';
import type { ArtifactTarget } from '../artifacts/artifact.types';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
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
 * Renders Markdown content through the shared transcript primitives.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, artifactId, onArtifactOpen }) => {
  const components: Components = artifactId && onArtifactOpen
    ? {
        ...markdownComponents,
        code(props) {
          const source = extractText(props.children).replace(/\n$/, '');
          const position = (props.node as MarkdownCodeProps['node'] | undefined)?.position?.start ?? {};
          const targetId = `${artifactId}:code:${position.offset ?? contentHash(source)}`;
          return renderMarkdownCode(props, (code, language) => onArtifactOpen({
            kind: 'code',
            id: targetId,
            title: `${language || 'Code'} line ${position.line ?? 1}`,
            language,
            content: code,
          }), targetId);
        },
      }
    : markdownComponents;
  return (
    <div className={cn('min-w-0 overflow-hidden break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
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
  code(props) { return renderMarkdownCode(props); },

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

interface MarkdownCodeProps {
  className?: string;
  children?: React.ReactNode;
  node?: {
    properties?: { className?: string[] };
    position?: { start?: { line?: number; offset?: number } };
  };
}

function renderMarkdownCode(
  { className: codeClassName, children, ...rest }: MarkdownCodeProps,
  onPreview?: (code: string, language?: string) => void,
  artifactTargetId?: string,
) {
  const lang = /language-(\w+)/.exec(codeClassName || '')?.[1];
  const text = extractText(children).replace(/\n$/, '');
  const node = (rest as { node?: { properties?: { className?: string[] } } })?.node;
  const block = node?.properties?.className?.[0]?.startsWith('language-') || lang;
  if (block || lang) {
    return <CodeBlock code={text} language={lang} highlight onPreview={onPreview} artifactTargetId={artifactTargetId} />;
  }
  if (!text.includes('\n') && text.length < 200) {
    return <code className="rounded bg-[#2a2a2a] px-1.5 py-0.5 font-mono text-[13px] text-gray-300">{text}</code>;
  }
  return <CodeBlock code={text} />;
}

function contentHash(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
