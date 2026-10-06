import React, { type ReactNode } from 'react';

export function ProjectDeploymentEvidenceSection(props: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      {props.description ? <p className="mt-1 text-xs text-muted-foreground">{props.description}</p> : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function DeploymentEvidenceEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}
