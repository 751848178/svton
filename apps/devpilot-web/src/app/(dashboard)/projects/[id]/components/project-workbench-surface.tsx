import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const PROJECT_SURFACE_SHADOW =
  'shadow-[0_1px_2px_rgba(20,24,36,.045),0_8px_24px_rgba(20,24,36,.04)]';

export const PROJECT_COMPACT_ACTION_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded px-2 sm:min-h-8';

export const PROJECT_COMPACT_ICON_ACTION_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded sm:min-h-9 sm:min-w-9';

export function ProjectSectionHeading(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex min-h-[46px] flex-wrap items-start justify-between gap-4 border-b pb-3.5',
        props.className,
      )}
    >
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.015em]">{props.title}</h3>
        {props.description ? (
          <p className="mt-1 text-xs leading-[1.5] text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      {props.actions}
    </header>
  );
}

export function ProjectTableSurface(props: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  fillAvailableHeight?: boolean;
  variant?: 'card' | 'embedded';
}) {
  const embedded = props.variant === 'embedded';
  return (
    <section
      data-project-table-surface
      data-project-table-variant={embedded ? 'embedded' : 'card'}
      className={cn(
        'min-w-0 max-w-full overflow-hidden bg-background',
        !embedded && 'rounded-xl border border-border/70',
        props.fillAvailableHeight && 'flex min-h-0 flex-1 flex-col',
        !embedded && PROJECT_SURFACE_SHADOW,
        props.className,
      )}
    >
      {props.title ? (
        <ProjectSectionHeading
          title={props.title}
          description={props.description}
          actions={props.actions}
          className="mx-4 shrink-0 pt-4"
        />
      ) : props.actions ? (
        <header className="mx-4 flex min-h-[52px] shrink-0 flex-wrap items-center justify-end gap-2 border-b py-2">
          {props.actions}
        </header>
      ) : null}
      <div
        data-project-table-content
        className={cn(
          'min-w-0 w-full max-w-full overflow-x-auto',
          props.fillAvailableHeight && 'flex min-h-0 flex-1 flex-col overflow-hidden',
        )}
      >
        {props.children}
      </div>
    </section>
  );
}

export function ProjectTableViewport(props: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={props.label}
      tabIndex={0}
      data-project-table-scroll
      className="min-h-0 max-w-full flex-1 overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      {props.children}
    </div>
  );
}

export const PROJECT_TABLE_CLASS =
  // impeccable-disable-next-line design-system-font-size -- documented dense table body
  'w-full border-collapse text-left text-[12.5px] [&_th]:h-11 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-foreground/80 [&_td]:h-[58px] [&_td]:whitespace-nowrap [&_td]:border-t [&_td]:px-4 [&_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[#f8f8ff]';
