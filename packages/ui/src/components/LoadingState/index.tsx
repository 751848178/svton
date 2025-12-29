import React, { CSSProperties, ReactNode } from 'react';

type Align = 'start' | 'center' | 'end';

type Justify = 'start' | 'center' | 'end';

export interface LoadingStateProps {
  text?: ReactNode;
  spinner?: boolean;
  className?: string;
  style?: CSSProperties;
  align?: Align;
  justify?: Justify;
}

export function LoadingState(props: LoadingStateProps) {
  const {
    text = 'Loading...',
    spinner = true,
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
        gap: 12,
        ...style,
      }}
    >
      {spinner ? (
        <div
          aria-label="loading"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '3px solid rgba(0,0,0,0.12)',
            borderTopColor: 'rgba(0,0,0,0.6)',
            animation: 'svton-ui-spin 0.8s linear infinite',
          }}
        />
      ) : null}
      {text ? <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)' }}>{text}</div> : null}
      <style>{
        '@keyframes svton-ui-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'
      }</style>
    </div>
  );
}

export const Loading = LoadingState;
