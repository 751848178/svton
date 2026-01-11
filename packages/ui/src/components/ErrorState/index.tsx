import React, { CSSProperties, ReactNode } from 'react';

type Align = 'start' | 'center' | 'end';
type Justify = 'start' | 'center' | 'end';

export interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: Align;
  justify?: Justify;
}

export function ErrorState(props: ErrorStateProps) {
  const {
    title = 'Something went wrong',
    message,
    action,
    className,
    style,
    align = 'center',
    justify = 'center',
  } = props;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
        justifyContent: justify === 'start' ? 'flex-start' : justify === 'end' ? 'flex-end' : 'center',
        padding: 24,
        gap: 8,
        textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center',
        ...style,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,0,0,0.85)' }}>{title}</div>
      {message ? <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>{message}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export const Error = ErrorState;
