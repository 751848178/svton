import React, { CSSProperties, ReactNode } from 'react';

type Align = 'start' | 'center' | 'end';

type Justify = 'start' | 'center' | 'end';

export interface EmptyStateProps {
  text?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: Align;
  justify?: Justify;
}

export function EmptyState(props: EmptyStateProps) {
  const {
    text = 'No data',
    description,
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
      <div style={{ fontSize: 16, color: 'rgba(0,0,0,0.72)' }}>{text}</div>
      {description ? <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>{description}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export const Empty = EmptyState;
