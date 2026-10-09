'use client';
import { ArrowLeft, Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { errorText } from '@/lib/api';
import { statusLabel, tone } from '@/lib/presentation';

export function Status({ value, label }: { value?: string | null; label?: string }) {
  const variant = tone(value);
  return <span className={`status ${variant}`}>
    {variant === 'good' && <Check size={13} aria-hidden="true" />}
    {variant === 'error' && <CircleAlert size={13} aria-hidden="true" />}
    {value === 'running' && <LoaderCircle size={13} aria-hidden="true" />}
    {label || statusLabel(value)}
  </span>;
}
export function PageHead({ title, section, description, onBack, backLabel, disabled, children }: {
  title: string; section?: string; description?: string; onBack?: () => void; backLabel?: string;
  disabled?: boolean; children?: React.ReactNode;
}) {
  return <div className="page-head"><div>
    <div className="page-title">{onBack && <button className="title-back" onClick={onBack} disabled={disabled} aria-label={backLabel || '返回项目列表'}><ArrowLeft size={20} aria-hidden="true" /></button>}
      <h1>{title}{section && <><span className="heading-separator">/</span>{section}</>}</h1>
    </div>{description && <p className="subtle">{description}</p>}
  </div>{children && <div className="head-actions">{children}</div>}</div>;
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? <div className="error-message" role="alert">{errorText(error)}</div> : null;
}
export function LoadingPanel({ text = '正在读取真实状态…' }: { text?: string }) {
  return <section className="panel"><div className="state-message" role="status">{text}</div></section>;
}
export function EmptyPanel({ text, children }: { text: string; children?: React.ReactNode }) {
  return <section className="panel"><div className="state-message"><p>{text}</p>{children}</div></section>;
}
