'use client';

import React from 'react';
import Link from 'next/link';
import { Warning } from '@phosphor-icons/react';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';

export function ProjectContextIssue(props: { message: string; actionLabel: string; href: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground sm:px-4"
      role="status"
    >
      <span className="inline-flex min-w-0 flex-1 items-start gap-2 leading-6">
        <Warning
          size={18}
          weight="fill"
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        {props.message}
      </span>
      <Link
        href={props.href}
        className={`${PROJECT_COMPACT_ACTION_CLASS} font-medium text-primary hover:underline`}
      >
        {props.actionLabel} →
      </Link>
    </div>
  );
}
