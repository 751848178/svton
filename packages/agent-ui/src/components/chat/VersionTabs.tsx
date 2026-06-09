'use client';

import React, { useState } from 'react';
import { cn } from '@svton/ui';

export interface VersionedContent {
  /** Version content */
  content: string;
  /** Version label (e.g., "v1", "v2") */
  label?: string;
  /** Timestamp */
  timestamp?: number;
}

export interface VersionTabsProps {
  /** Available versions */
  versions: VersionedContent[];
  /** Currently active version index */
  activeIndex?: number;
  /** Callback when version changes */
  onVersionChange?: (index: number) => void;
  /** Render content for the active version */
  children: React.ReactNode;
  className?: string;
}

/**
 * Version tabs for regenerated AI messages.
 * Follows the Doubao pattern: show tabs for multiple versions
 * with the active version highlighted and historical versions dimmed.
 */
export function VersionTabs({ versions, activeIndex: controlledIndex, onVersionChange, children, className }: VersionTabsProps) {
  const [internalIndex, setInternalIndex] = useState(versions.length - 1);
  const activeIndex = controlledIndex ?? internalIndex;

  if (versions.length <= 1) {
    return <>{children}</>;
  }

  const handleVersionChange = (index: number) => {
    setInternalIndex(index);
    onVersionChange?.(index);
  };

  return (
    <div className={className}>
      {/* Version tabs */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[10px] text-gray-400 mr-1">
          {versions.length} versions
        </span>
        {versions.map((v, i) => (
          <button
            key={i}
            onClick={() => handleVersionChange(i)}
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors',
              i === activeIndex
                ? 'bg-blue-100 text-blue-700'
                : 'bg-[#222] text-gray-400 hover:text-gray-300 hover:bg-[#333]',
            )}
          >
            {v.label || `v${i + 1}`}
          </button>
        ))}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
