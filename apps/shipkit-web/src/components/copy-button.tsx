'use client';
import { useId, useState, type MouseEvent } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text, label = '复制', iconOnly = false }: { text: string; label?: string; iconOnly?: boolean }) {
  const [state, setState] = useState('');
  const statusId = useId();
  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    if (iconOnly) event.stopPropagation();
    try { await navigator.clipboard.writeText(text); setState('已复制'); }
    catch { setState(iconOnly ? '复制失败，请检查剪贴板权限后重试' : '复制失败，请选中文字复制'); }
  };
  const copied = state === '已复制';
  const button = <button type="button" className={`button ghost small${iconOnly ? ' image-copy-button' : ''}`} onClick={copy} aria-label={iconOnly ? label : state || label} aria-describedby={iconOnly && state ? statusId : undefined} title={iconOnly ? state || label : undefined}>
    {iconOnly && copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{!iconOnly && <span aria-live="polite">{state || label}</span>}
  </button>;
  return iconOnly ? <span className="image-copy-control">{button}<span id={statusId} role="status" aria-live="polite" className={state.startsWith('复制失败') ? 'image-copy-feedback error' : 'visually-hidden'}>{state}</span></span> : button;
}
