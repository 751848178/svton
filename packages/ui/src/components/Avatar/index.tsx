import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const avatarVariants = cva('flex items-center justify-center overflow-hidden shrink-0 bg-black/5 text-black/65', {
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
    return (
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    );
  };

  return (
    <div className={cn(avatarVariants({ size, shape }), className)}>
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
          {React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size, className: cn('ring-2 ring-white', child.props.className) }) : child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="-ml-2 relative z-0">
          <Avatar size={size} className="ring-2 ring-white bg-black/15">+{remaining}</Avatar>
        </div>
      )}
    </div>
  );
}
