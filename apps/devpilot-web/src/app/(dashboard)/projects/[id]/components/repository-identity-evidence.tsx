import React from 'react';

export function RepositoryIdentityEvidence({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono">{value}</dd>
    </div>
  );
}
