import React from 'react';

export function ReleaseProductionFact(props: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-0.5 truncate ${props.mono ? 'font-mono text-xs' : 'text-sm'}`}
        title={props.title ?? props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
