import React, { CSSProperties } from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | false;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton(props: SkeletonProps) {
  const {
    width = '100%',
    height = 20,
    variant = 'text',
    animation = 'pulse',
    className,
    style,
  } = props;

  const getBorderRadius = () => {
    switch (variant) {
      case 'circular': return '50%';
      case 'rectangular': return 0;
      case 'rounded': return 8;
      case 'text': default: return 4;
    }
  };

  const getAnimationStyle = (): CSSProperties => {
    if (!animation) return {};
    if (animation === 'wave') {
      return {
        background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%)',
        backgroundSize: '200% 100%',
        animation: 'svton-skeleton-wave 1.5s ease-in-out infinite',
      };
    }
    return { animation: 'svton-skeleton-pulse 1.5s ease-in-out infinite' };
  };

  return (
    <>
      <div
        className={className}
        style={{
          display: 'block',
          width: variant === 'circular' ? height : width,
          height,
          borderRadius: getBorderRadius(),
          backgroundColor: 'rgba(0,0,0,0.08)',
          ...getAnimationStyle(),
          ...style,
        }}
      />
      <style>{`
        @keyframes svton-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes svton-skeleton-wave {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

export interface SkeletonGroupProps {
  count?: number;
  gap?: number;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonGroup(props: SkeletonGroupProps) {
  const { count = 3, gap = 12, children, className, style } = props;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children || Array.from({ length: count }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );
}
