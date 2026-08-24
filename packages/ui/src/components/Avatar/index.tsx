import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { AgentIcon } from '../../icons';

const avatarVariants = cva('flex items-center justify-center overflow-hidden shrink-0 bg-muted text-muted-foreground', {
  variants: {
    size: {
      small: 'size-6 text-xs',
      default: 'size-10 text-base',
      large: 'size-16 text-xl',
    },
    shape: {
      circle: 'rounded-full',
      square: 'rounded',
    },
  },
  defaultVariants: {
    size: 'default',
    shape: 'circle',
  },
});

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Avatar(props: AvatarProps) {
  const { src, alt, size, shape, icon, children, className } = props;
  const [imgError, setImgError] = useState(false);

  const renderContent = () => {
    if (src && !imgError) {
      return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setImgError(true)} />;
    }
    if (icon) return icon;
    if (children) return <span className="font-medium">{children}</span>;
    return <AgentIcon width="60%" height="60%" aria-hidden="true" />;
  };

  const labelledFallback = Boolean(alt) && (!src || imgError) && !icon && !children;
  return (
    <div
      className={cn(avatarVariants({ size, shape }), className)}
      role={labelledFallback ? 'img' : undefined}
      aria-label={labelledFallback ? alt : undefined}
    >
      {renderContent()}
    </div>
  );
}

export interface AvatarGroupProps {
  children: ReactNode;
  max?: number;
  size?: 'small' | 'default' | 'large';
  className?: string;
}

export function AvatarGroup(props: AvatarGroupProps) {
  const { children, max, size = 'default', className } = props;
  const childArray = React.Children.toArray(children);
  const displayChildren = max ? childArray.slice(0, max) : childArray;
  const remaining = max ? childArray.length - max : 0;

  return (
    <div className={cn('flex', className)}>
      {displayChildren.map((child, index) => (
        <div key={index} className={cn(index > 0 && '-ml-2', 'relative')} style={{ zIndex: displayChildren.length - index }}>
          {React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size, className: cn('ring-2 ring-background', (child.props as AvatarProps).className) }) : child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="-ml-2 relative z-0">
          <Avatar size={size} className="ring-2 ring-background bg-muted">+{remaining}</Avatar>
        </div>
      )}
    </div>
  );
}
