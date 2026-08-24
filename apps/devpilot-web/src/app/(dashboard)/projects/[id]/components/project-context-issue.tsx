'use client';

import React from 'react';
import Link from 'next/link';
import { Warning } from '@phosphor-icons/react';

export function ProjectContextIssue(props: { message: string; actionLabel: string; href: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-4 text-sm"
      role="status"
    >
      <span className="inline-flex items-center gap-2 text-amber-700">
        <Warning
          size={18}
          weight="fill"
          aria-hidden="true"
        />
        {props.message}
      </span>
      <Link
        href={props.href}
        className="font-medium text-primary hover:underline"
      >
        {props.actionLabel} →
      </Link>
    </div>
  );
}
