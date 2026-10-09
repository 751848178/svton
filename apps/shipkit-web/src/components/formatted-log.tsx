'use client';
import { useMemo } from 'react';
import { parseLog, rawLogText } from '@/lib/log-presentation';

export function FormattedLog({ text, raw }: { text: string; raw: boolean }) {
  const lines = useMemo(() => parseLog(text), [text]);
  if (raw) return <pre className="log-raw">{rawLogText(text)}</pre>;
  return <div className="formatted-log" aria-label="带行号的日志文本">
    {lines.map((line, index) => <div className={`log-line log-line-${line.kind}`} key={index}>
      <span className="log-line-number" aria-hidden="true">{index + 1}</span>
      <code className="log-line-text">{line.segments.length ? line.segments.map((segment, part) => <span key={part} style={{ color: segment.color, fontWeight: segment.bold ? 650 : undefined, fontStyle: segment.italic ? 'italic' : undefined, textDecoration: segment.underline ? 'underline' : undefined }}>{segment.text}</span>) : '\u00a0'}</code>
    </div>)}
  </div>;
}
